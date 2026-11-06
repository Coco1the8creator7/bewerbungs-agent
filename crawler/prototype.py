"""Dependency-free, offline-first apprenticeship extraction proof of concept.

Only reads explicitly supplied local HTML fixture files. Never performs HTTP
requests or writes to Career.Agency production or legacy dashboard files.
"""
from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

TRACKING = {"fbclid", "gclid", "msclkid"}
FIELDS = ("title", "company", "location", "profession", "start_year", "application_url")


def canonical_url(value: str) -> str:
    url = urlsplit(value.strip())
    if url.scheme not in {"https", "http"} or not url.hostname:
        raise ValueError("An absolute HTTP(S) URL is required")
    params = sorted((k, v) for k, v in parse_qsl(url.query, keep_blank_values=True)
                    if k.lower() not in TRACKING and not k.lower().startswith("utm_"))
    host = url.hostname.lower()
    port = url.port
    if port and not ((url.scheme == "https" and port == 443) or (url.scheme == "http" and port == 80)):
        host += f":{port}"
    path = re.sub(r"/+$", "", url.path) or "/"
    return urlunsplit((url.scheme.lower(), host, path, urlencode(params), ""))


class FixtureParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.records = []
        self.current = None
        self.nesting = 0

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if self.current is None and tag == "article" and "data-source-id" in attributes:
            self.current = dict(attributes)
            self.current["_depth"] = 1
        elif self.current is not None:
            self.current["_depth"] += 1

    def handle_startendtag(self, tag, attrs):
        # Self-closing tags are irrelevant to this proof of concept.
        return

    def handle_endtag(self, tag):
        if self.current is not None:
            self.current["_depth"] -= 1
            if self.current["_depth"] == 0:
                self.records.append(self.current)
                self.current = None


def extract_fixture(source_name: str, document: str) -> list[dict]:
    if not re.fullmatch(r"[a-z][a-z0-9_-]{1,63}", source_name):
        raise ValueError("Invalid source name")
    parser = FixtureParser()
    parser.feed(document)
    output = []
    for attrs in parser.records:
        source_id = attrs.get("data-source-id", "").strip()
        if not source_id:
            continue
        values = {field: html.unescape(attrs.get("data-" + field.replace("_", "-"), "")).strip()
                  for field in FIELDS}
        if not values["title"] or not values["company"] or not values["location"]:
            continue
        try:
            url = canonical_url(attrs["data-url"])
            if values["application_url"]:
                values["application_url"] = canonical_url(values["application_url"])
            year = int(values["start_year"]) if values["start_year"] else None
            if year is not None and not 2020 <= year <= 2100:
                continue
        except (ValueError, KeyError):
            continue
        # The source-specific listing ID is the durable record identity.
        uid = hashlib.sha256(f"{source_name}|{source_id}".encode()).hexdigest()[:24]
        item = {"id": "apprenticeship-" + uid, "source": source_name,
                "source_listing_id": source_id, "source_url": url,
                **{key: values[key] or None for key in FIELDS}}
        item["start_year"] = year
        item["content_hash"] = hashlib.sha256(json.dumps(
            {k: item[k] for k in ("source_url", *FIELDS)}, sort_keys=True,
            ensure_ascii=False).encode()).hexdigest()
        output.append(item)
    return output


def reconcile(previous: list[dict], current: list[dict], *, complete: bool = True) -> dict:
    old = {record["id"]: record for record in previous}
    fresh = {}
    duplicate_ids = []
    for record in current:
        if record["id"] in fresh:
            duplicate_ids.append(record["id"])
        fresh[record["id"]] = record
    if duplicate_ids:
        raise ValueError("Duplicate source IDs in current snapshot")
    added = [v for k, v in fresh.items() if k not in old]
    changed = [v for k, v in fresh.items() if k in old and v["content_hash"] != old[k]["content_hash"]]
    unchanged = [v for k, v in fresh.items() if k in old and v["content_hash"] == old[k]["content_hash"]]
    # Missing items are only candidates; never infer that a listing has closed.
    missing_candidates = [v for k, v in old.items() if k not in fresh] if complete else []
    return {"added": added, "changed": changed, "unchanged": unchanged,
            "missing_candidates": missing_candidates, "snapshot_complete": complete}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--html", required=True, type=Path)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    data = extract_fixture(args.source, args.html.read_text(encoding="utf-8"))
    previous = json.loads(args.previous.read_text(encoding="utf-8")) if args.previous else []
    result = reconcile(previous, data)
    payload = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(payload, encoding="utf-8")
    else:
        print(payload, end="")


if __name__ == "__main__":
    main()
