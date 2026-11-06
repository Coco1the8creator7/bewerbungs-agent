import json
import unittest
from crawler.yousty_jsonld import extract_jsonld_listings


def fixture(items, total=24078):
    payload = {"@type":"CollectionPage","mainEntity":{
        "@type":"ItemList","numberOfItems":total,"itemListElement":items}}
    return '<script type="application/ld+json">'+json.dumps(payload)+'</script>'


def listing(id, title):
    return {"@type":"ListItem","position":1,"name":title,
        "item":f"https://www.yousty.ch/de-CH/lehrstellen/profile/{id}-test"}


class YoustyJSONLDTests(unittest.TestCase):
    def test_structured_fields_and_qualification(self):
        out = extract_jsonld_listings(fixture([
            listing(123, "Sanitärinstallateur/in EFZ"),
            listing(124, "Dipl. Pflegefachmann/-frau HF")]))
        self.assertEqual(out["reported_total"], 24078)
        self.assertEqual(len(out["records"]), 2)
        self.assertEqual(out["records"][0]["qualification_group"], "basic_efz_eba")
        self.assertEqual(out["records"][1]["qualification_group"], "other_or_unknown")
        self.assertIsNone(out["records"][0]["company"])

    def test_deduplicates_repeated_id(self):
        out = extract_jsonld_listings(fixture([listing(1, "Schreiner/in EFZ"),
                                               listing(1, "Schreiner/in EFZ")]))
        self.assertEqual(len(out["records"]), 1)

    def test_rejects_foreign_and_malformed_urls(self):
        entries = [listing(22, "Elektroniker/in EFZ"), {
            "@type":"ListItem", "name":"Wrong", "item":
            "https://evil.example/de-CH/lehrstellen/profile/20-fake"}]
        out = extract_jsonld_listings(fixture(entries))
        self.assertEqual(len(out["records"]), 1)
        self.assertEqual(out["invalid_entries"], 1)

    def test_conflicting_duplicate_fails(self):
        with self.assertRaises(ValueError):
            extract_jsonld_listings(fixture([listing(123, "Koch/Köchin EFZ"),
                                              listing(123, "Schreiner/in EFZ")]))

    def test_no_collection_returns_empty(self):
        out = extract_jsonld_listings('<html><script type="application/ld+json">'
                                     '{"@type":"WebSite"}</script></html>')
        self.assertEqual(out["records"], [])
        self.assertIsNone(out["reported_total"])


if __name__ == "__main__":
    unittest.main()
