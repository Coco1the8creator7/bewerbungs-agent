"""One-record Yousty detail -> isolated PostgreSQL POC adapter.

Never fetches Yousty or accesses production. Dry-run by default; --commit
explicitly persists ONE validated record to careeragency_test only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from crawler.yousty_detail import extract_detail

EXPECTED_DB = "careeragency_test"
SOURCE = "yousty_poc"


def normalize(item: dict) -> dict:
    if item.get("source") != "yousty":
        raise ValueError("Incorrect source")
    source_id = item["source_listing_id"]
    if not isinstance(source_id, str) or not source_id.isdecimal():
        raise ValueError("Invalid Yousty listing ID")
    location = item.get("job_location")
    if not isinstance(location, dict):
        raise ValueError("Missing structured job location")
    if location.get("country") != "CH":
        raise ValueError("Expected CH address")
    city = location.get("city")
    if not isinstance(city, str) or not city.strip():
        raise ValueError("Missing city")
    company = item.get("company")
    title = item.get("title")
    if not isinstance(company, str) or not company.strip():
        raise ValueError("Missing employer")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("Missing title")
    start = item.get("job_start_date")
    year = None
    if start is not None:
        if not isinstance(start, str) or len(start) < 10:
            raise ValueError("Unrecognized start date")
        from datetime import date
        year = date.fromisoformat(start[:10]).year
    url = item.get("source_url")
    if not isinstance(url, str) or not url.startswith(
            f"https://www.yousty.ch/de-CH/lehrstellen/profile/{source_id}-"):
        raise ValueError("Source URL does not match source ID")
    stable_id = "apprenticeship-" + hashlib.sha256(
        f"{SOURCE}|{source_id}".encode()).hexdigest()[:24]
    record = {"id": stable_id, "source": SOURCE, "source_listing_id": source_id,
              "source_url": url, "title": title.strip(), "company": company.strip(),
              "location": city.strip(), "profession": None, "start_year": year,
              "application_url": None}
    hashed_fields = {k: record[k] for k in ("source_url", "title", "company",
                      "location", "profession", "start_year", "application_url")}
    record["content_hash"] = hashlib.sha256(json.dumps(
        hashed_fields, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return record


def store(conn, record: dict, *, commit: bool = False) -> dict:
    """Keep source disabled and run snapshot_complete=false (single detail)."""
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(), current_user")
        db_name, username = cur.fetchone()
        if db_name != EXPECTED_DB or username != "careeragency_test":
            raise RuntimeError("Only limited careeragency_test role/database permitted")
    result = {}
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                            ("careeragency-poc:" + SOURCE,))
                cur.execute("""
                    INSERT INTO apprenticeship_poc.sources (code,display_name,enabled)
                    VALUES (%s,%s,false)
                    ON CONFLICT (code) DO UPDATE SET display_name=EXCLUDED.display_name
                    RETURNING id
                """, (SOURCE, "Yousty - restricted validation POC"))
                source_id = cur.fetchone()[0]
                cur.execute("""
                    INSERT INTO apprenticeship_poc.import_runs
                    (source_id,snapshot_complete)
                    VALUES (%s,false) RETURNING id
                """, (source_id,))
                run_id = cur.fetchone()[0]
                cur.execute("""
                    SELECT id,content_hash FROM apprenticeship_poc.listings
                    WHERE source_id=%s AND source_listing_id=%s FOR UPDATE
                """, (source_id, record["source_listing_id"]))
                before = cur.fetchone()
                if before and before[0] != record["id"]:
                    raise ValueError("Conflicting source-to-internal ID")
                state = ("inserted" if not before else
                         "unchanged" if before[1] == record["content_hash"] else "changed")
                if state == "unchanged":
                    cur.execute("""
                        UPDATE apprenticeship_poc.listings
                        SET last_seen_at=now(),last_import_run_id=%s
                        WHERE id=%s
                    """, (run_id, record["id"]))
                else:
                    cur.execute("""
                        INSERT INTO apprenticeship_poc.listings
                        (id,source_id,source_listing_id,source_url,title,company,location,
                         profession,start_year,application_url,content_hash,last_import_run_id)
                        VALUES (%(id)s,%(source_id)s,%(source_listing_id)s,%(source_url)s,
                                %(title)s,%(company)s,%(location)s,%(profession)s,
                                %(start_year)s,%(application_url)s,%(content_hash)s,%(run_id)s)
                        ON CONFLICT (source_id,source_listing_id) DO UPDATE SET
                          title=EXCLUDED.title, company=EXCLUDED.company,
                          location=EXCLUDED.location,profession=EXCLUDED.profession,
                          start_year=EXCLUDED.start_year,
                          source_url=EXCLUDED.source_url,
                          application_url=EXCLUDED.application_url,
                          content_hash=EXCLUDED.content_hash,
                          content_changed_at=now(),last_seen_at=now(),
                          last_import_run_id=EXCLUDED.last_import_run_id
                    """, {**record, "source_id": source_id, "run_id": run_id})
                cur.execute("""
                    UPDATE apprenticeship_poc.import_runs
                    SET status='completed',completed_at=now(),seen_count=1
                    WHERE id=%s
                """, (run_id,))
                result = {"source": SOURCE, "source_listing_id": record["source_listing_id"],
                          "action": state, "snapshot_complete": False, "committed": commit}
            if not commit:
                # Roll back within the transaction, including new source and run logs.
                raise _DryRunRollback()
    except _DryRunRollback:
        pass
    return result


class _DryRunRollback(Exception):
    pass


def main():
    try:
        import psycopg
    except ImportError as exc:
        raise SystemExit("Install psycopg 3 in the dedicated virtual environment") from exc
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", required=True, type=Path)
    parser.add_argument("--commit", action="store_true", help="Persist to isolated test DB")
    args = parser.parse_args()
    item = normalize(extract_detail(args.html.read_text(encoding="utf-8")))
    with psycopg.connect(dbname=EXPECTED_DB, connect_timeout=5,
                         options="-c statement_timeout=15000") as con:
        # Avoid implicit outer transaction by using autocommit with explicit transaction.
        con.autocommit = True
        result = store(con, item, commit=args.commit)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
