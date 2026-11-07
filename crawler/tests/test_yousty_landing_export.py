import json
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest

from crawler.yousty_landing_export import collect, write_atomic


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def execute(self, *_args):
        pass
    def fetchone(self):
        return ("careeragency_test", "careeragency_test")
    def fetchall(self):
        return self.rows


class FakeConn:
    def __init__(self, rows):
        self.rows = rows
    def cursor(self):
        return FakeCursor(self.rows)


NOW = datetime(2026, 11, 7, 10, 0, tzinfo=timezone.utc)


def db_record(source_id="11989876", title="Lehrstelle als Sanitärinstallateur/in EFZ"):
    return ("apprenticeship-" + "a" * 24,
            source_id, title, "Equans Switzerland AG", "Zürich", 2027,
            "https://www.yousty.ch/de-CH/lehrstellen/profile/" + source_id + "-sanitaer",
            NOW, NOW)


class LandingExportTests(unittest.TestCase):
    def test_verified_listing_mapped_into_existing_landing_shape(self):
        jobs = collect(FakeConn([db_record()]), {"11989876"})
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["id"], "apprenticeship-" + "a" * 24)
        self.assertEqual(jobs[0]["source"], "yousty.ch")
        self.assertEqual(jobs[0]["source_job_id"], "11989876")
        self.assertIn("EFZ", jobs[0]["categories"])
        self.assertEqual(jobs[0]["first_seen_at"], NOW.isoformat())
        self.assertNotIn("availability", jobs[0])
        self.assertIn("nicht unabhängig bestätigt", jobs[0]["description"])

    def test_title_without_lehrstelle_gets_safe_prefix(self):
        jobs = collect(FakeConn([db_record(title="Konstrukteur/in EFZ")]), {"11989876"})
        self.assertEqual(jobs[0]["title"], "Lehrstelle als Konstrukteur/in EFZ")

    def test_no_leakage_of_unverified_or_wrong_rows(self):
        other = db_record("999", "Lehrstelle als Koch/Köchin EFZ")
        jobs = collect(FakeConn([db_record(), other]), {"11989876"})
        self.assertEqual(len(jobs), 1)
        with self.assertRaises(ValueError):
            collect(FakeConn([]), {"11989876"})

    def test_atomic_staging_no_direct_live_webroot(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "jobs.json"
            write_atomic([{"id": "apprenticeship-demo", "title": "Test"}], target)
            self.assertEqual(json.loads(target.read_text())[0]["title"], "Test")
            self.assertFalse(target.with_name("jobs.json.new").exists())
        with self.assertRaises(ValueError):
            write_atomic([{"id": "bad"}], Path("/var/www/careeragency/current/jobs.json"))


if __name__ == "__main__":
    unittest.main()
