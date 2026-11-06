"""Read Yousty JSON-LD ItemList from already saved search HTML.

No network access or database writes. Uses only source-provided title and URL;
employer, location, start year and availability remain unknown.
"""
from __future__ import annotations

from html.parser import HTMLParser
import json
import re
from urllib.parse import urlsplit

PROFILE = re.compile(r"^/de-CH/lehrstellen/profile/([0-9]+)(?:-[^/?#]*)?/?$")
BASIC_QUALIFICATION = re.compile(r"\b(?:EFZ|EBA)\b", re.IGNORECASE)
OTHER_QUALIFICATION = re.compile(r"\b(?:HF|FH|Bachelor|Master)\b", re.IGNORECASE)


class _JSONLD(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self._capturing = False
        self._body = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "script":
            self._capturing = dict(attrs).get("type", "").lower() == "application/ld+json"
            self._body = []

    def handle_data(self, data):
        if self._capturing:
            self._body.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "script" and self._capturing:
            try:
                self.blocks.append(json.loads("".join(self._body)))
            except json.JSONDecodeError:
                pass
            self._capturing = False
            self._body = []


def _iter_collections(value):
    if isinstance(value, list):
        for item in value:
            yield from _iter_collections(item)
    elif isinstance(value, dict):
        if value.get("@type") == "CollectionPage":
            yield value
        if "@graph" in value:
            yield from _iter_collections(value["@graph"])


def extract_jsonld_listings(document: str) -> dict:
    parser = _JSONLD()
    parser.feed(document)
    entries = {}
    reported_total = None
    invalid_entries = 0
    for block in parser.blocks:
        for collection in _iter_collections(block):
            entity = collection.get("mainEntity")
            if not isinstance(entity, dict) or entity.get("@type") != "ItemList":
                continue
            total = entity.get("numberOfItems")
            if type(total) is int and total >= 0:
                reported_total = total
            for entry in entity.get("itemListElement", []):
                if not isinstance(entry, dict) or entry.get("@type") != "ListItem":
                    invalid_entries += 1
                    continue
                title = entry.get("name")
                url = entry.get("item")
                if not isinstance(title, str) or not title.strip() or not isinstance(url, str):
                    invalid_entries += 1
                    continue
                parsed = urlsplit(url)
                match = PROFILE.fullmatch(parsed.path)
                if (parsed.scheme != "https" or parsed.hostname != "www.yousty.ch"
                        or parsed.port not in (None, 443) or not match
                        or parsed.username or parsed.password):
                    invalid_entries += 1
                    continue
                listing_id = match.group(1)
                title = " ".join(title.split())
                is_basic = bool(BASIC_QUALIFICATION.search(title)) and not bool(
                    OTHER_QUALIFICATION.search(title))
                normalized = {
                    "source": "yousty",
                    "source_listing_id": listing_id,
                    "source_url": f"https://www.yousty.ch{parsed.path}",
                    "title": title,
                    "qualification_group": "basic_efz_eba" if is_basic else "other_or_unknown",
                    "company": None,
                    "location": None,
                    "start_year": None,
                    "availability": "unverified",
                }
                if listing_id in entries:
                    if (entries[listing_id]["title"] != title
                            or entries[listing_id]["source_url"] != normalized["source_url"]):
                        raise ValueError(f"Conflicting details for Yousty ID {listing_id}")
                else:
                    entries[listing_id] = normalized
    return {"reported_total": reported_total, "records": list(entries.values()),
            "invalid_entries": invalid_entries,
            "note": "reported_total is a site-provided count, not verified collected jobs"}


if __name__ == "__main__":
    import argparse
    from pathlib import Path
    cli = argparse.ArgumentParser()
    cli.add_argument("html", type=Path, help="Saved HTML fixture; no network requests")
    args = cli.parse_args()
    print(json.dumps(extract_jsonld_listings(
        args.html.read_text(encoding="utf-8")), ensure_ascii=False, indent=2))
