"""PostgreSQL persistence for the isolated synthetic apprenticeship crawler POC.

Requires psycopg 3. No HTTP, no production credentials, no schema creation.
Each import is atomic and source-scoped. DO NOT enable against a real source.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from crawler.prototype import extract_fixture

SOURCE_RE = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")
EXPECTED_DB = "careeragency_test"


def ingest(conn, source: str, records: list[dict]) -> dict:
    """Upsert one *complete, nonempty synthetic* snapshot atomically.

    Run logs are committed with successful data only; errors roll back the
    transaction and are reported to the caller, not stored as committed runs.
    Missing records remain active, are never deleted or automatically closed.
    """
    if not SOURCE_RE.fullmatch(source) or not source.startswith("synthetic"):
        raise ValueError("POC only allows explicitly synthetic sources")
    if not records:
        raise ValueError("Refusing an empty snapshot")
    keys = [(r["source"], r["source_listing_id"]) for r in records]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate source listing IDs in snapshot")
    if any(r["source"] != source for r in records):
        raise ValueError("Mixed source input rejected")
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute("SELECT current_database()")
            if cur.fetchone()[0] != EXPECTED_DB:
                raise RuntimeError("Refusing any database other than careeragency_test")
            # A transaction-scoped advisory lock serialises overlapping imports
            # from the same source without touching other sources.
            cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                        ("careeragency-poc:" + source,))
            cur.execute("""
                INSERT INTO apprenticeship_poc.sources (code, display_name)
                VALUES (%s, %s)
                ON CONFLICT (code) DO UPDATE SET display_name=EXCLUDED.display_name
                RETURNING id
            """, (source, "Synthetic fixture (isolated POC)"))
            source_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO apprenticeship_poc.import_runs (source_id, snapshot_complete)
                VALUES (%s, true) RETURNING id
            """, (source_id,))
            run_id = cur.fetchone()[0]
            counts = {"inserted": 0, "changed": 0, "unchanged": 0}
            for item in records:
                # Validate identity and fields before any upsert. SQL constraints
                # independently enforce required values and hash format.
                if not item["id"].startswith("apprenticeship-"):
                    raise ValueError("Invalid listing ID")
                cur.execute("""
                    SELECT id, content_hash FROM apprenticeship_poc.listings
                    WHERE source_id=%s AND source_listing_id=%s FOR UPDATE
                """, (source_id, item["source_listing_id"]))
                existing = cur.fetchone()
                if existing is not None and existing[0] != item["id"]:
                    raise ValueError("Source ID now maps to a different internal ID")
                kind = "inserted" if existing is None else (
                    "changed" if existing[1] != item["content_hash"] else "unchanged")
                if kind == "unchanged":
                    # Refresh only operational provenance; preserve content_changed_at.
                    cur.execute("""
                        UPDATE apprenticeship_poc.listings
                        SET last_seen_at=now(), last_import_run_id=%s, missing_count=0
                        WHERE id=%s
                    """, (run_id, item["id"]))
                else:
                    cur.execute("""
                        INSERT INTO apprenticeship_poc.listings
                        (id,source_id,source_listing_id,source_url,title,company,location,
                         profession,start_year,application_url,content_hash,last_import_run_id)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (source_id,source_listing_id) DO UPDATE SET
                          source_url=EXCLUDED.source_url,
                          title=EXCLUDED.title,company=EXCLUDED.company,
                          location=EXCLUDED.location,profession=EXCLUDED.profession,
                          start_year=EXCLUDED.start_year,
                          application_url=EXCLUDED.application_url,
                          content_hash=EXCLUDED.content_hash,
                          content_changed_at=now(),
                          last_seen_at=now(),
                          last_import_run_id=EXCLUDED.last_import_run_id,
                          missing_count=0
                    """, (item["id"], source_id, item["source_listing_id"],
                          item["source_url"], item["title"], item["company"],
                          item["location"], item["profession"], item["start_year"],
                          item["application_url"], item["content_hash"], run_id))
                counts[kind] += 1
            # No closure inference. Merely count absent records.
            cur.execute("""
                SELECT count(*) FROM apprenticeship_poc.listings
                WHERE source_id=%s AND last_import_run_id IS DISTINCT FROM %s
            """, (source_id, run_id))
            missing_candidates = cur.fetchone()[0]
            cur.execute("""
                UPDATE apprenticeship_poc.import_runs
                SET status='completed', completed_at=now(), seen_count=%s
                WHERE id=%s
            """, (len(records), run_id))
    return {"source": source, "run_id": run_id, **counts,
            "missing_candidates": missing_candidates}


def main() -> None:
    import argparse
    try:
        import psycopg
    except ImportError as exc:
        raise SystemExit("Install psycopg inside a virtual environment first") from exc
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="synthetic")
    parser.add_argument("--html", type=Path, required=True)
    parser.add_argument("--dbname", default=EXPECTED_DB)
    args = parser.parse_args()
    if args.dbname != EXPECTED_DB:
        parser.error("Only careeragency_test is allowed")
    records = extract_fixture(args.source, args.html.read_text(encoding="utf-8"))
    with psycopg.connect(dbname=args.dbname, connect_timeout=5,
                         options="-c statement_timeout=15000") as conn:
        result = ingest(conn, args.source, records)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
