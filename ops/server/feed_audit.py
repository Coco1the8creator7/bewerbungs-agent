#!/usr/bin/env python3
"""Validate the existing private Yousty landing feed without exposing its records.

No database, HTTP, filesystem writes or third-party requests. The installed
forced-command wrapper invokes this script without user-controlled arguments.
"""
from __future__ import annotations

from collections import Counter
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

LIVE_FEED = Path("/srv/careeragency-landing-feed/jobs.json")
MAX_BYTES = 10_000_000
ID_RE = re.compile(r"apprenticeship-[0-9a-f]{24}\Z")
SOURCE_ID_RE = re.compile(r"[0-9]+\Z")
PROFILE_RE = re.compile(r"/de-CH/lehrstellen/profile/([0-9]+)(?:-[^/?#]*)?/?\Z")
START_RE = re.compile(r"Lehrbeginn ([0-9]{4})\Z")


def _check_url(url: object, source_id: str) -> bool:
    if not isinstance(url, str):
        return False
    try:
        p = urlsplit(url)
        match = PROFILE_RE.fullmatch(p.path)
        return bool(
            p.scheme == "https" and p.hostname == "www.yousty.ch"
            and p.port in (None, 443)
            and p.username is None and p.password is None
            and not p.query and not p.fragment
            and match and match.group(1) == source_id
        )
    except ValueError:
        return False


def audit(path: Path) -> dict[str, object]:
    """Raise ValueError on any non-Yousty, ambiguous or malformed listing.

    Only aggregate diagnostic metrics are returned. The complete feed and
    job titles/company names never enter public GitHub Actions logs.
    """
    try:
        metadata = path.stat()
    except OSError as exc:
        raise ValueError("Feed not accessible") from exc
    if not path.is_file() or not 0 < metadata.st_size <= MAX_BYTES:
        raise ValueError("Feed missing, empty or exceeds 10 MB")

    try:
        items = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("Feed is not valid UTF-8 JSON") from exc

    if not isinstance(items, list) or not 0 < len(items) <= 10_000:
        raise ValueError("Feed must be a nonempty array of <= 10,000 listings")

    ids: set[str] = set()
    source_ids: set[str] = set()
    years: Counter[str] = Counter()
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Non-object listing")
        item_id, source_id = item.get("id"), item.get("source_job_id")
        if not isinstance(item_id, str) or not ID_RE.fullmatch(item_id):
            raise ValueError("Invalid apprenticeship ID")
        if not isinstance(source_id, str) or not SOURCE_ID_RE.fullmatch(source_id):
            raise ValueError("Invalid source listing ID")
        if item_id in ids or source_id in source_ids:
            raise ValueError("Duplicate internal or source listing ID")
        ids.add(item_id)
        source_ids.add(source_id)
        if item.get("source") != "yousty.ch":
            raise ValueError("Unapproved feed source; legacy adult jobs prohibited")
        if not _check_url(item.get("url"), source_id):
            raise ValueError("Unverified Yousty source URL")
        if any(not isinstance(item.get(k), str) or not item[k].strip()
               for k in ("title", "company", "location")):
            raise ValueError("Missing mandatory listing metadata")
        categories = item.get("categories")
        if (not isinstance(categories, list) or
                not all(isinstance(c, str) for c in categories) or
                "Lehrstelle" not in categories or
                not any(c in ("EFZ", "EBA") for c in categories)):
            raise ValueError("Missing apprenticeship categories")
        start_years = [m.group(1) for c in categories if (m := START_RE.fullmatch(c))]
        if len(start_years) != 1 or not 2026 <= int(start_years[0]) <= 2035:
            raise ValueError("Invalid or ambiguous apprenticeship start year")
        years[start_years[0]] += 1

    return {
        "feed_records": len(items),
        "feed_only_yousty": True,
        "feed_unique_ids": True,
        "feed_year_counts": dict(sorted(years.items())),
        "feed_bytes": metadata.st_size,
        "production_modified": False,
    }


def main() -> None:
    try:
        result = audit(LIVE_FEED)
    except ValueError as exc:
        print("feed_audit=failed: " + str(exc))
        raise SystemExit(2) from None
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
