"""Conservative parser for saved Yousty search-page HTML.

No network calls or persistence. Extracts stable profile IDs and anchor text.
All inferred title/company/location fields remain unverified until comparison
against a real saved page. Does not claim to know opening counts or vacancies.
"""
from __future__ import annotations

from html.parser import HTMLParser
import re
from urllib.parse import urljoin, urlsplit

BASE = "https://www.yousty.ch"
PROFILE = re.compile(r"^/de-CH/lehrstellen/profile/(\d+)(?:-[^/?#]*)?/?$")
SPACE = re.compile(r"\s+")


class _Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.current = None
        self.depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.current is not None:
            self.depth += 1
            return
        if tag == "a":
            href = attrs.get("href", "")
            path = urlsplit(urljoin(BASE, href)).path
            matched = PROFILE.fullmatch(path)
            if matched:
                self.current = {"source_listing_id": matched.group(1),
                                "source_url": urljoin(BASE, href), "_text": []}
                self.depth = 1

    def handle_data(self, value):
        if self.current is not None:
            self.current["_text"].append(value)

    def handle_endtag(self, tag):
        if self.current is None:
            return
        self.depth -= 1
        if self.depth == 0:
            item = self.current
            item["link_text"] = SPACE.sub(" ", " ".join(item.pop("_text"))).strip()
            self.links.append(item)
            self.current = None


def extract_listing_links(document: str) -> list[dict]:
    """Deduplicate repeated anchors with the same numeric Yousty profile ID."""
    parser = _Links()
    parser.feed(document)
    by_id = {}
    for item in parser.links:
        key = item["source_listing_id"]
        if key not in by_id:
            by_id[key] = item
        elif len(item["link_text"]) > len(by_id[key]["link_text"]):
            by_id[key] = item
    return list(by_id.values())
