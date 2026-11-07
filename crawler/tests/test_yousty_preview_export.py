import json
import sqlite3
import tempfile
from pathlib import Path
import unittest

from crawler.yousty_preview_export import (
    accepted_ids, collect_records, render_page, verified_profile_url
)


def item(id="11989876", title="Lehrstelle als Sanitärinstallateur/in EFZ"):
    return {"id": id, "title": title, "company": "Equans Switzerland AG",
            "location": "Zürich", "year": 2027,
            "url": f"https://www.yousty.ch/de-CH/lehrstellen/profile/{id}-sanitaer"}


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows
        self.which = 0
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def execute(self, sql):
        self.which += 1
    def fetchone(self):
        return ("careeragency_test", "careeragency_test")
    def fetchall(self):
        return self.rows


class FakeConn:
    def __init__(self, rows):
        self.rows = rows
    def cursor(self):
        return FakeCursor(self.rows)


class PreviewExportTests(unittest.TestCase):
    def test_render_safe_html_escape(self):
        record = item(title='<script>alert("x")</script>')
        output = render_page([record], "2026-11-07 10:00")
        self.assertNotIn('<script>alert("x")</script>', output)
        self.assertIn('&lt;script&gt;', output)
        self.assertIn('Originalinserat bei Yousty', output)

    def test_profile_link_host_and_id_restrictions(self):
        self.assertTrue(verified_profile_url(item()["url"], item()["id"]))
        self.assertFalse(verified_profile_url(
            "https://example.com/de-CH/lehrstellen/profile/11989876-x", "11989876"))
        self.assertFalse(verified_profile_url(item()["url"], "1"))
        self.assertFalse(verified_profile_url(item()["url"] + "?utm_campaign=test", item()["id"]))

    def test_collect_only_checkpoint_verified_records(self):
        rows = [("11989876", "Lehrstelle als Sanitärinstallateur/in EFZ",
                 "Equans Switzerland AG", "Zürich", 2027, item()["url"]),
                ("999", "Andere Stelle", "Anderer Arbeitgeber", "Bern", 2026,
                 "https://www.yousty.ch/de-CH/lehrstellen/profile/999-x")]
        output = collect_records(FakeConn(rows), {"11989876"})
        self.assertEqual(len(output), 1)
        self.assertEqual(output[0]["company"], "Equans Switzerland AG")

    def test_missing_accepted_id_fails_export(self):
        with self.assertRaisesRegex(ValueError, "missing"):
            collect_records(FakeConn([]), {"11989876"})

    def test_checkpoint_validates_canton_and_qualification(self):
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp) / "checkpoint.sqlite3"
            with sqlite3.connect(file) as conn:
                conn.execute("CREATE TABLE candidates(source_listing_id TEXT, detail_json TEXT, outcome TEXT)")
                detail = {"source_listing_id": "11989876",
                          "title": "Lehrstelle als Sanitärinstallateur/in EFZ",
                          "job_location": {"region": "ZH", "country": "CH", "city": "Zürich"}}
                conn.execute("INSERT INTO candidates VALUES (?,?,?)",
                             ("11989876", json.dumps(detail), "accepted"))
            self.assertEqual(accepted_ids(file), {"11989876"})


if __name__ == "__main__":
    unittest.main()
