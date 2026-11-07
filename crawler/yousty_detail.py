"""Offline Yousty detail JSON-LD JobPosting extractor.

Reads saved HTML only. Never fetches, writes to database or assumes that
JSON-LD field presence guarantees a useful value. All extracted text is
untrusted source data and must be escaped at display time.
"""
from __future__ import annotations

from html.parser import HTMLParser
import json
from urllib.parse import urlsplit
import re


class _Blocks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.inside = False
        self.data = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "script":
            self.inside = dict(attrs).get("type", "").lower() == "application/ld+json"
            self.data = []

    def handle_data(self, text):
        if self.inside:
            self.data.append(text)

    def handle_endtag(self, tag):
        if tag.lower() == "script" and self.inside:
            try:
                self.blocks.append(json.loads("".join(self.data)))
            except (json.JSONDecodeError, ValueError):
                pass
            self.inside = False


def _nodes(obj):
    if isinstance(obj, list):
        for item in obj:
            yield from _nodes(item)
    elif isinstance(obj, dict):
        typ = obj.get("@type")
        if typ == "JobPosting" or (isinstance(typ, list) and "JobPosting" in typ):
            yield obj
        if "@graph" in obj:
            yield from _nodes(obj["@graph"])


def _name(obj):
    if isinstance(obj, str):
        return obj.strip() or None
    if isinstance(obj, dict):
        value = obj.get("name")
        return value.strip() or None if isinstance(value, str) else None
    return None


def _place(obj):
    if isinstance(obj, list):
        return [_place(item) for item in obj]
    if not isinstance(obj, dict):
        return None
    addr = obj.get("address")
    if isinstance(addr, dict):
        return {"street": addr.get("streetAddress"), "postal_code": addr.get("postalCode"),
                "city": addr.get("addressLocality"), "region": addr.get("addressRegion"),
                "country": addr.get("addressCountry")}
    return {"name": _name(obj)}


def _clean_url(value):
    if not isinstance(value, str):
        return None
    parts = urlsplit(value)
    if (parts.scheme == "https" and parts.hostname == "www.yousty.ch"
            and parts.username is None and parts.password is None
            and parts.port in (None, 443)):
        return "https://www.yousty.ch" + parts.path
    return None


def extract_detail(document: str) -> dict:
    parser = _Blocks()
    parser.feed(document)
    postings = [node for block in parser.blocks for node in _nodes(block)]
    if len(postings) != 1:
        raise ValueError(f"Expected exactly one JobPosting, got {len(postings)}")
    post = postings[0]
    url = _clean_url(post.get("url"))
    if not url:
        raise ValueError("Missing or unexpected Yousty detail URL")
    match = re.fullmatch(r"/de-CH/lehrstellen/profile/([0-9]+)(?:-[^/?#]*)?/?", urlsplit(url).path)
    if not match:
        raise ValueError("Unrecognized Yousty profile path")
    title = post.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("Missing title")
    employer = post.get("hiringOrganization")
    return {
        "source": "yousty", "source_listing_id": match.group(1),
        "source_url": url, "title": title.strip(),
        "company": _name(employer), "job_location": _place(post.get("jobLocation")),
        "job_start_date": post.get("jobStartDate"),
        "date_posted": post.get("datePosted"), "valid_through": post.get("validThrough"),
        "employment_type": post.get("employmentType"),
        "direct_apply": post.get("directApply"),
        "description": post.get("description"),
        "occupational_category": post.get("occupationalCategory"),
        "education_requirements": post.get("educationRequirements"),
        "identifier": post.get("identifier"),
        "availability": "unverified",
    }
