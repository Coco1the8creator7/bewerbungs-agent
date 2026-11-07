"""Export verified Yousty ZH listings for EXISTING Career.Agency landing cards.

No HTTP calls, no PostgreSQL writes, no website publication.
Exports only verified apprentice records from careeragency_test and the
local accepted ZH checkpoint to a staging file, not to GitHub.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re

from crawler.yousty_preview_export import accepted_ids, verified_profile_url

DB_NAME = "careeragency_test"
SOURCE = "yousty_poc"
QUALIFICATION = re.compile(r"\\b(EFZ|EBA)\\b", re.IGNORECASE)
JOB_PREFIX = re.compile(r"\\b(?:lehrstelle|lehrling|ausbildungsplatz|lehre als|lernende[rn]?)\\b", re.I)


def collect(conn, verified: set[str]) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(), current_user")
        if cur.fetchone() != (DB_NAME, "careeragency_test"):
            raise RuntimeError("Refusing non-isolated PostgreSQL connection")
        cur.execute("""
          SELECT l.id,l.source_listing_id,l.title,l.company,l.location,
                 l.start_year,l.source_url,l.first_seen_at,l.last_seen_at
          FROM apprenticeship_poc.listings l
          JOIN apprenticeship_poc.sources s ON s.id=l.source_id
          WHERE s.code=%s
          ORDER BY l.id
        """, (SOURCE,))
        rows = cur.fetchall()
    exported, found = [], set()
    for internal_id, listing_id, title, company, location, year, url, first, last in rows:
        listing_id = str(listing_id)
        if listing_id not in verified:
            continue
        if listing_id in found:
            raise ValueError("Duplicate verified source ID")
        found.add(listing_id)
        if (not isinstance(internal_id, str) or
            not re.fullmatch(r"apprenticeship-[a-f0-9]{24}", internal_id)):
            raise ValueError(f"Unexpected internal ID for {listing_id}")
        if (not all(isinstance(value, str) and value.strip()
                    for value in (title, company, location)) or
            not isinstance(year, int) or year not in (2027, 2028) or
            not verified_profile_url(url, listing_id)):
            raise ValueError(f"Invalid mandatory values for {listing_id}")
        level = QUALIFICATION.search(title)
        if not level:
            raise ValueError(f"Qualification missing for {listing_id}")
        display_title = title.strip()
        if not JOB_PREFIX.search(display_title):
            display_title = "Lehrstelle als " + display_title
        def iso(value):
            return value.isoformat() if hasattr(value, "isoformat") else None
        if not iso(first) or not iso(last):
            raise ValueError("Missing DB first/last seen timestamp")
        description = (
            "Lehrstelle mit geplantem Beginn im Jahr " + str(year) +
            ". Aufgaben und Anforderungen stehen im verlinkten Originalinserat bei Yousty. " +
            "Die aktuelle Verfügbarkeit wurde von Career.Agency noch nicht unabhängig bestätigt."
        )
        exported.append({
            "schema_version": "0.1.0",
            "id": internal_id,
            "source": "yousty.ch",
            "source_job_id": listing_id,
            "title": display_title,
            "company": company.strip(),
            "location": location.strip(),
            "url": url,
            "description": description,
            "published_at": None,
            "first_seen_at": iso(first),
            "last_seen_at": iso(last),
            "categories": ["Lehrstelle", level.group(1).upper(), "Lehrbeginn " + str(year)],
            "processing": {
                "state": "needs_review",
                "warnings": ["Verfügbarkeit nicht unabhängig bestätigt"],
                "extraction_confidence": None,
            },
            "matching": {"status": "not_run", "score": None},
        })
    missing = verified - found
    if missing:
        raise ValueError(f"{len(missing)} accepted checkpoint entries absent from test database")
    if not exported:
        raise ValueError("Refusing an empty export")
    return exported


def write_atomic(records: list[dict], target: Path):
    if target.name != "jobs.json":
        raise ValueError("Staging output must be named jobs.json")
    if target.resolve().is_relative_to(Path("/var/www/careeragency")):
        raise ValueError("Refusing direct writes into the live webroot")
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(target.name + ".new")
    temp.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.chmod(temp, 0o600)
    os.replace(temp, target)


def main():
    import psycopg
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, default=Path("/tmp/yousty-zh-200.sqlite3"))
    parser.add_argument("--output", type=Path, default=Path("/tmp/careeragency-landing-staging/jobs.json"))
    args = parser.parse_args()
    ids = accepted_ids(args.checkpoint)
    with psycopg.connect(dbname=DB_NAME, connect_timeout=5,
                         options="-c statement_timeout=15000") as conn:
        records = collect(conn, ids)
    write_atomic(records, args.output)
    print(json.dumps({"staged": len(records), "path": str(args.output),
                      "production_changed": False, "source": SOURCE}, ensure_ascii=False))


if __name__ == "__main__":
    main()
