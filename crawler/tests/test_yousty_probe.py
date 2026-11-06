import unittest
from unittest.mock import patch
from crawler.yousty_probe import inspect_text, probe


class YoustyProbeTests(unittest.TestCase):
    def test_inspect_synthetic_html(self):
        report = inspect_text('<html><article><a href="/de-CH/lehrstellen/123">test</a></article>'
                              '<script type="application/ld+json">{}</script>Lehrstellen gefunden</html>')
        self.assertEqual(report["article_elements"], 1)
        self.assertEqual(report["json_ld_scripts"], 1)
        self.assertTrue(report["looks_like_search_results"])

    @patch("crawler.yousty_probe.read_one")
    def test_robots_disallow_stops_page_request(self, fetch):
        fetch.return_value = (200, "User-agent: *\nDisallow: /")
        result = probe()
        self.assertEqual(result["status"], "blocked_by_robots")
        self.assertEqual(fetch.call_count, 1)

    @patch("crawler.yousty_probe.read_one")
    def test_robots_failure_stops_page_request(self, fetch):
        fetch.side_effect = OSError("no network")
        result = probe()
        self.assertEqual(result["status"], "robots_unverified")
        self.assertEqual(fetch.call_count, 1)

    @patch("crawler.yousty_probe.read_one")
    def test_allowed_fetches_at_most_one_listing_page(self, fetch):
        fetch.side_effect = [(200, "User-agent: *\nAllow: /"), (200, "<html>Lehrstellensuche</html>")]
        result = probe()
        self.assertEqual(result["status"], "diagnostic_only")
        self.assertEqual(fetch.call_count, 2)


if __name__ == "__main__":
    unittest.main()
