"""Regression checks for the isolated offline apprenticeship prototype."""
import unittest
from pathlib import Path
from crawler.prototype import canonical_url, extract_fixture, reconcile

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "synthetic.html"


class PrototypeTests(unittest.TestCase):
    def setUp(self):
        self.items = extract_fixture("synthetic", FIXTURE.read_text(encoding="utf-8"))

    def test_extract_valid_synthetic_apprenticeships(self):
        self.assertEqual(len(self.items), 2)
        self.assertEqual(self.items[0]["start_year"], 2027)
        self.assertEqual(self.items[0]["source_url"], "https://example.org/lehrstellen/001")

    def test_canonical_url_preserves_non_tracking_params(self):
        self.assertEqual(canonical_url("https://EXAMPLE.org/a/?utm_source=x&year=2027#top"),
                         "https://example.org/a?year=2027")

    def test_dedup_same_source_id(self):
        with self.assertRaises(ValueError):
            reconcile([], self.items + [dict(self.items[0])])

    def test_change_detection(self):
        updated = [dict(x) for x in self.items]
        updated[0]["title"] = "Informatiker/in EFZ (aktualisiert)"
        updated[0]["content_hash"] = "different"
        result = reconcile(self.items, updated)
        self.assertEqual(len(result["changed"]), 1)
        self.assertEqual(len(result["unchanged"]), 1)

    def test_missing_is_not_closed_and_incomplete_is_safe(self):
        self.assertEqual(len(reconcile(self.items, [self.items[0]])["missing_candidates"]), 1)
        self.assertEqual(reconcile(self.items, [], complete=False)["missing_candidates"], [])

    def test_invalid_urls_ignored(self):
        listing = '<article data-source-id="evil" data-url="javascript:alert(1)" data-title="x" data-company="y" data-location="z"></article>'
        self.assertEqual(extract_fixture("synthetic", listing), [])


if __name__ == "__main__":
    unittest.main()
