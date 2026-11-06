import unittest
from crawler.yousty_parser import extract_listing_links


class YoustyParserTests(unittest.TestCase):
    def test_profile_ids_and_dedup(self):
        html = """<html><a href="/de-CH/lehrstellen/profile/12345-informatiker-efz">Informatiker/in EFZ</a>
        <a href="/de-CH/lehrstellen/profile/12345-informatiker-efz"><span>Informatiker/in EFZ Bei Muster AG</span></a>
        <a href="/de-CH/lehrstellen/profile/7777-logistiker">Logistiker/in EFZ</a></html>"""
        found = extract_listing_links(html)
        self.assertEqual(len(found), 2)
        self.assertEqual(found[0]["source_listing_id"], "12345")
        self.assertIn("Muster AG", found[0]["link_text"])

    def test_unrelated_and_external_paths_excluded(self):
        html = """<a href="https://evil.example/de-CH/lehrstellen/profile/9-foo">External</a>
        <a href="/de-CH/lehrstellen/berufe">Navigation</a>
        <a href="/de-CH/lehrstellen/profile/9876-gute-lehre">Gute Lehre</a>"""
        found = extract_listing_links(html)
        self.assertEqual([x["source_listing_id"] for x in found], ["9876"])

    def test_no_inferred_company_or_availability(self):
        found = extract_listing_links('<a href="/de-CH/lehrstellen/profile/12-foo">Foo</a>')
        self.assertNotIn("company", found[0])
        self.assertNotIn("availability", found[0])


if __name__ == "__main__":
    unittest.main()
