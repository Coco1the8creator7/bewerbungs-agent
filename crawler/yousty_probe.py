"""Yousty ONE-PAGE technical feasibility probe (not a bulk crawler).

Performs at most one robots.txt request, and one public listing-page request,
unless robots cannot be checked or disallows the target. No API calls, login,
pagination, cookies, database writes, browser automation or retries.

Usage:
  python -m crawler.yousty_probe --output /tmp/yousty-probe.json
A human must review terms and grant permission before any commercial reuse.
"""
from __future__ import annotations
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

BASE = "https://www.yousty.ch"
ROBOTS = BASE + "/robots.txt"
TARGET = BASE + "/de-CH/lehrstellen"
USER_AGENT = "CareerAgencyFeasibilityProbe/0.1 (single-page research; no bulk collection)"
MAX_BYTES = 2_000_000


def read_one(url: str, *, limit: int = MAX_BYTES) -> tuple[int, str]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,text/plain;q=0.9"})
    with urlopen(request, timeout=12) as response:
        final = response.geturl()
        if urlsplit(final).hostname != "www.yousty.ch" or urlsplit(final).scheme != "https":
            raise ValueError("Unexpected cross-origin redirect; refusing")
        size = response.headers.get("Content-Length")
        if size and int(size) > limit:
            raise ValueError("Response exceeds size cap")
        payload = response.read(limit + 1)
        if len(payload) > limit:
            raise ValueError("Response exceeds size cap")
        content_type = response.headers.get("Content-Type", "")
        if "html" not in content_type and "text/plain" not in content_type:
            raise ValueError("Unexpected content type")
        return response.status, payload.decode("utf-8", errors="replace")


class InspectHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.jsonld = 0
        self.articles = 0
        self.anchor_paths = {}
        self.app_hints = set()

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "script" and d.get("type", "").lower() == "application/ld+json":
            self.jsonld += 1
        if tag == "article":
            self.articles += 1
        if tag == "a":
            href = d.get("href", "")
            # Aggregate shape only; no actual job URLs or private data retained.
            path = urlsplit(href).path
            if re.search(r"lehrstell|apprentice|job", path, re.I):
                shape = re.sub(r"\d+", "{n}", path)[:100]
                self.anchor_paths[shape] = self.anchor_paths.get(shape, 0) + 1
        if tag == "script":
            src = d.get("src", "")
            if "next" in src.lower():
                self.app_hints.add("nextjs-script")
            if "assets" in src.lower():
                self.app_hints.add("asset-bundle")


def inspect_text(document: str) -> dict:
    parser = InspectHTML()
    parser.feed(document)
    return {
        "document_characters": len(document),
        "article_elements": parser.articles,
        "json_ld_scripts": parser.jsonld,
        "candidate_anchor_path_shapes": parser.anchor_paths,
        "app_hints": sorted(parser.app_hints),
        "looks_like_search_results": bool(re.search(r"Lehrstellen gefunden|Lehrstellensuche", document, re.I)),
    }


def probe() -> dict:
    result = {"source": "yousty", "target": TARGET, "mode": "single_page_diagnostic",
              "no_database_writes": True, "commercial_republication_authorized": False}
    try:
        status, robots = read_one(ROBOTS, limit=200_000)
        result["robots_status"] = status
        parser = RobotFileParser()
        parser.parse(robots.splitlines())
        allowed = parser.can_fetch(USER_AGENT, TARGET)
        result["robots_allows_probe"] = allowed
        if not allowed:
            result["status"] = "blocked_by_robots"
            return result
    except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
        result["status"] = "robots_unverified"
        result["error_type"] = type(exc).__name__
        return result
    try:
        status, document = read_one(TARGET)
        result.update(inspect_text(document))
        result["http_status"] = status
        result["status"] = "diagnostic_only"
    except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
        result["status"] = "page_unavailable"
        result["error_type"] = type(exc).__name__
    return result


def main() -> None:
    cli = argparse.ArgumentParser()
    cli.add_argument("--output", type=Path, help="Write structural metrics only; no raw HTML")
    args = cli.parse_args()
    result = probe()
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    print(text, end="")


if __name__ == "__main__":
    main()
