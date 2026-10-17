import json
import tempfile
import unittest
from pathlib import Path
from importer.main import import_messages
from importer.parser import extract, canonicalize

class ImportTests(unittest.TestCase):
    def test_url_tracking_and_wrapper(self):
        self.assertEqual(canonicalize("https://EXAMPLE.com/jobs/123?utm_source=mail&x=1#top"), "https://example.com/jobs/123?x=1")
        self.assertIsNone(canonicalize("javascript:alert(1)"))
    def test_activation_ignored(self):
        self.assertEqual(extract("jobmail@jobs.ch", "Bitte bestätigen Sie Ihre Anmeldung", "https://jobs.ch/job/123"), [])
    def test_multiple_and_incremental_and_cross_sender(self):
        a = {"id":"m1","from":"jobmail@jobs.ch","subject":"Neue Stellen","body":"", "html":'<a href="https://jobs.ch/jobs/123?utm_source=x">Projektleiter Energie</a><a href="https://jobs.ch/jobs/456">Fachplaner Fernwärme</a><a href="https://x.ch/unsubscribe">Abmelden</a>',"received_at":"2026-10-17T10:00:00+00:00"}
        b = dict(a,id="m2",from_="x")
        b["from"] = "no-reply@publicjobs.ch"
        b["html"] = '<a href="https://jobs.ch/jobs/123?utm_source=public">Projektleiter Energie</a>'
        with tempfile.TemporaryDirectory() as folder:
            db, out = Path(folder)/"jobs.sqlite3",Path(folder)/"jobs.json"
            first = import_messages([a,b],db,out)
            self.assertEqual(first["exported_jobs"],2)
            self.assertEqual(first["offers_extracted"],3)
            self.assertEqual(import_messages([a,b],db,out)["skipped_unchanged"],2)
            rows=json.loads(out.read_text())
            self.assertTrue(all(row["processing"]["state"]=="needs_review" for row in rows))
            self.assertTrue(all(row["schema_version"]=="0.1.0" for row in rows))
if __name__ == "__main__":
    unittest.main()
