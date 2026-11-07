"""Offline regression tests of the live-feed aggregate audit with synthetic data."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "server/feed_audit.py"
spec = importlib.util.spec_from_file_location("ca_feed_audit", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def record(source_id: str = "12345678") -> dict:
    return {
        "schema_version": "0.1.0",
        "id": "apprenticeship-" + source_id.zfill(24),
        "source": "yousty.ch",
        "source_job_id": source_id,
        "title": "Lehrstelle als Konstrukteur/in EFZ",
        "company": "Musterbetrieb AG",
        "location": "Zürich",
        "url": "https://www.yousty.ch/de-CH/lehrstellen/profile/" + source_id + "-muster",
        "categories": ["Lehrstelle", "EFZ", "Lehrbeginn 2027"],
        "description": "Sample text which must never enter logs.",
    }


class FeedAuditTests(unittest.TestCase):
    def audit_records(self, records):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "jobs.json"
            file.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
            return module.audit(file)

    def test_valid_yousty_listing_aggregates_without_exposing_job_data(self):
        summary = self.audit_records([record("12345678"), record("87654321")])
        self.assertEqual(summary["feed_records"], 2)
        self.assertTrue(summary["feed_only_yousty"])
        self.assertTrue(summary["feed_unique_ids"])
        self.assertEqual(summary["feed_year_counts"], {"2027": 2})
        self.assertFalse(summary["production_modified"])
        self.assertNotIn("Musterbetrieb", json.dumps(summary))
        self.assertNotIn("12345678", json.dumps(summary))

    def test_rejects_legacy_adult_data(self):
        adult = record()
        adult["source"] = "jobs.ch"
        with self.assertRaisesRegex(ValueError, "legacy adult jobs prohibited"):
            self.audit_records([adult])

    def test_rejects_duplicate_internal_or_source_ids(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            self.audit_records([record(), record()])

    def test_rejects_mismatched_and_outbound_urls(self):
        bad = record()
        bad["url"] = "https://yousty.ch/de-CH/lehrstellen/profile/12345678-muster"
        with self.assertRaisesRegex(ValueError, "source URL"):
            self.audit_records([bad])
        bad["url"] = "https://www.yousty.ch/de-CH/lehrstellen/profile/99999999-muster"
        with self.assertRaisesRegex(ValueError, "source URL"):
            self.audit_records([bad])

    def test_rejects_non_apprenticeship_category(self):
        bad = record()
        bad["categories"] = ["Job", "EFZ", "Lehrbeginn 2027"]
        with self.assertRaisesRegex(ValueError, "apprenticeship categories"):
            self.audit_records([bad])

    def test_rejects_malformed_and_empty_file(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "jobs.json"
            for content in ("", "no-json", '{"jobs":[]}'):
                file.write_text(content)
                with self.assertRaises(ValueError):
                    module.audit(file)


if __name__ == "__main__":
    unittest.main()
