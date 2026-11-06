import copy
import unittest

from crawler.yousty_db_poc import normalize


BASE = {
    "source": "yousty",
    "source_listing_id": "11989876",
    "source_url": "https://www.yousty.ch/de-CH/lehrstellen/profile/11989876-sanitaer",
    "title": "Lehrstelle als Sanitärinstallateur/in EFZ",
    "company": "Equans Switzerland AG",
    "job_location": {
        "street": "Buckhauserstrasse 22", "postal_code": "8048",
        "city": "Zürich", "region": "ZH", "country": "CH"
    },
    "job_start_date": "2027-08-01"
}


class YoustyDBMappingTests(unittest.TestCase):
    def test_normalization_maps_real_shape(self):
        result = normalize(BASE)
        self.assertEqual(result["source"], "yousty_poc")
        self.assertEqual(result["location"], "Zürich")
        self.assertEqual(result["start_year"], 2027)
        self.assertEqual(len(result["content_hash"]), 64)
        self.assertTrue(result["id"].startswith("apprenticeship-"))

    def test_stable_identity_and_content_hash(self):
        original = normalize(BASE)
        updated = copy.deepcopy(BASE)
        updated["company"] = "Another employer"
        changed = normalize(updated)
        self.assertEqual(original["id"], changed["id"])
        self.assertNotEqual(original["content_hash"], changed["content_hash"])

    def test_missing_location_fails_closed(self):
        updated = copy.deepcopy(BASE)
        updated["job_location"] = {"city": None, "country": "CH"}
        with self.assertRaises(ValueError):
            normalize(updated)

    def test_wrong_host_fails_closed(self):
        updated = copy.deepcopy(BASE)
        updated["source_url"] = "https://evil.example/de-CH/lehrstellen/profile/11989876-x"
        with self.assertRaises(ValueError):
            normalize(updated)


if __name__ == "__main__":
    unittest.main()
