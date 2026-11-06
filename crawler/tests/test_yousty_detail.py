import json
import unittest
from crawler.yousty_detail import extract_detail


def page(post):
    return '<script type="application/ld+json">' + json.dumps(post) + '</script>'


class YoustyDetailTests(unittest.TestCase):
    def test_full_jobposting(self):
        post = {"@type": "JobPosting",
                "title": "Sanitärinstallateur/in EFZ",
                "url": "https://www.yousty.ch/de-CH/lehrstellen/profile/11989876-sanit",
                "hiringOrganization": {"@type": "Organization", "name": "Muster AG"},
                "jobLocation": {"address": {"addressLocality": "Zürich",
                                              "postalCode": "8000", "addressRegion": "ZH"}},
                "jobStartDate": "2027-08-01", "validThrough": "2027-07-31"}
        result = extract_detail(page(post))
        self.assertEqual(result["source_listing_id"], "11989876")
        self.assertEqual(result["company"], "Muster AG")
        self.assertEqual(result["job_location"]["city"], "Zürich")
        self.assertEqual(result["availability"], "unverified")

    def test_missing_fields_are_not_fabricated(self):
        result = extract_detail(page({"@type": "JobPosting", "title": "Koch/Köchin EFZ",
            "url": "https://www.yousty.ch/de-CH/lehrstellen/profile/10-koch"}))
        self.assertIsNone(result["company"])
        self.assertIsNone(result["job_start_date"])

    def test_foreign_domain_rejected(self):
        with self.assertRaises(ValueError):
            extract_detail(page({"@type": "JobPosting", "title": "X",
                "url": "https://evil.example/de-CH/lehrstellen/profile/123-fake"}))

    def test_multiple_postings_fail_closed(self):
        a = {"@type": "JobPosting", "title": "X",
             "url": "https://www.yousty.ch/de-CH/lehrstellen/profile/12-x"}
        with self.assertRaises(ValueError):
            extract_detail(page([a, a]))


if __name__ == "__main__":
    unittest.main()
