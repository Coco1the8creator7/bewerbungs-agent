import json
import tempfile
from pathlib import Path
from unittest.mock import Mock
import unittest

from crawler.yousty_zh_batch import (
    accepted, is_zh, run, search_url,
)


def page_html(page):
    entries = []
    for i in range(10):
        n = page * 1000 + i
        entries.append({"@type": "ListItem", "name": "Koch/Köchin EFZ",
            "item": f"https://www.yousty.ch/de-CH/lehrstellen/profile/{n}-kochin"})
    payload = {"@type": "CollectionPage", "mainEntity": {"@type": "ItemList",
        "numberOfItems": 4108, "itemListElement": entries}}
    return '<script type="application/ld+json">' + json.dumps(payload) + '</script>'


def detail_html(n, region="ZH"):
    payload = {"@type": "JobPosting", "title": "Lehrstelle als Koch/Köchin EFZ",
        "url": f"https://www.yousty.ch/de-CH/lehrstellen/profile/{n}-kochin",
        "hiringOrganization": {"name": "Testbetrieb AG"},
        "jobLocation": {"address": {"addressRegion": region,
            "addressCountry": "CH", "addressLocality": "Zürich"}},
        "jobStartDate": "2027-08-01"}
    return '<script type="application/ld+json">' + json.dumps(payload) + '</script>'


class ZurichBatchTests(unittest.TestCase):
    def test_canton_filter(self):
        item = {"title": "Koch/Köchin EFZ", "company": "Betrieb",
                "job_location": {"region": "ZH", "country": "CH", "city": "Zürich"},
                "job_start_date": "2027-08-01"}
        self.assertEqual(accepted(item), (True, None))
        item["job_location"]["region"] = "AG"
        self.assertFalse(is_zh(item))
        self.assertFalse(accepted(item)[0])

    def test_page_url_scoped(self):
        self.assertIn("/lehrstellen/ZH?", search_url(1))
        with self.assertRaises(ValueError):
            search_url(101)

    def test_two_accepts_then_resume_without_extra_fetch(self):
        with tempfile.TemporaryDirectory() as temp:
            db = Path(temp) / "state.sqlite3"
            def reader(url, limit=None):
                if url.endswith("robots.txt"):
                    return "User-agent: *\\nAllow: /"
                if "/lehrstellen/ZH?" in url:
                    return page_html(1)
                n = url.split("/profile/")[1].split("-")[0]
                return detail_html(n)
            from crawler.yousty_zh_batch import PoliteClient
            sleeper = Mock()
            client = PoliteClient(reader=reader, delay=sleeper, jitter=lambda a,b: 6)
            first = run(db, target=2, max_pages=1, max_details=2, client=client)
            self.assertEqual(first["total_accepted"], 2)
            self.assertEqual(first["committed"], 0)
            self.assertEqual(sleeper.call_count, 2)
            second = run(db, target=2, max_pages=1, max_details=2,
                         client=PoliteClient(reader=reader, delay=Mock()))
            self.assertEqual(second["total_accepted"], 2)
            self.assertEqual(second["details_attempted"], 0)


if __name__ == "__main__":
    unittest.main()
