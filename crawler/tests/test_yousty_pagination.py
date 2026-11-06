import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import Mock

from crawler.yousty_pagination import scan


def page_html(n):
    payload = {"@type": "CollectionPage", "mainEntity": {"@type": "ItemList",
        "numberOfItems": 24078, "itemListElement": [{"@type": "ListItem",
        "name": "Schreiner/in EFZ", "position": 1,
        "item": f"https://www.yousty.ch/de-CH/lehrstellen/profile/{n}-schreiner"}]}}
    return '<script type="application/ld+json">' + json.dumps(payload) + '</script>'


class YoustyPaginationTests(unittest.TestCase):
    def test_checkpoint_and_restart(self):
        with tempfile.TemporaryDirectory() as temp:
            db = Path(temp) / "pages.db"
            reader = Mock(side_effect=[page_html(101), page_html(102), page_html(103)])
            policy = Mock(can_fetch=Mock(return_value=True))
            delays = []
            initial = scan(db, 1, 2, reader=reader, policy=policy,
                           sleeper=delays.append, random_delay=lambda a, b: 7.0)
            self.assertEqual(initial["unique_listings"], 2)
            self.assertEqual(delays, [7.0])
            resumed = scan(db, 1, 3, reader=reader, policy=policy,
                           sleeper=delays.append, random_delay=lambda a, b: 7.0)
            self.assertEqual(resumed["already_saved"], 2)
            self.assertEqual(resumed["unique_listings"], 3)
            self.assertEqual(reader.call_count, 3)

    def test_disallowed_page_never_fetched(self):
        with tempfile.TemporaryDirectory() as temp:
            reader = Mock()
            result = scan(Path(temp) / "pages.db", 1, 1,
                          reader=reader, policy=Mock(can_fetch=Mock(return_value=False)))
            self.assertEqual(result["stopped"], "robots_disallow")
            reader.assert_not_called()

    def test_invalid_limits(self):
        with self.assertRaises(ValueError):
            scan(Path("/tmp/not-written.db"), max_pages=6)
        with self.assertRaises(ValueError):
            scan(Path("/tmp/not-written.db"), min_delay=0.1)


if __name__ == "__main__":
    unittest.main()
