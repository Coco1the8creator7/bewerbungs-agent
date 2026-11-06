"""Bounded Yousty canton-ZH pilot: discover and validate up to 200 offers.

Explicitly opt-in; not scheduled or attached to production. A local SQLite
checkpoint avoids duplicate detail fetches. PostgreSQL test import requires
--commit-test-db and uses the existing guarded Yousty POC adapter.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import random
import sqlite3
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

from crawler.yousty_detail import extract_detail
from crawler.yousty_jsonld import extract_jsonld_listings
from crawler.yousty_db_poc import normalize, store

HOST = "https://www.yousty.ch"
AGENT = "CareerAgencyResearchPilot/0.1 (careeragency.ch)"
MAX_BYTES = 2_000_000


def search_url(page):
    if not 1 <= page <= 100:
        raise ValueError("Pilot search limited to first 100 pages")
    return f"{HOST}/de-CH/lehrstellen/ZH?locale=de-CH&page={page}&result_type=main"


def read(url, limit=MAX_BYTES):
    with urlopen(Request(url, headers={"User-Agent": AGENT,
                                      "Accept": "text/html,text/plain;q=0.9"}), timeout=20) as resp:
        dest = urlsplit(resp.geturl())
        if dest.scheme != "https" or dest.hostname != "www.yousty.ch":
            raise ValueError("Cross-origin redirect")
        if resp.status != 200:
            raise ValueError("Unexpected HTTP response")
        body = resp.read(limit + 1)
        if len(body) > limit:
            raise ValueError("Excessive response size")
        return body.decode("utf-8", errors="replace")


class PoliteClient:
    def __init__(self, reader=read, delay=time.sleep, jitter=random.uniform):
        self.reader = reader
        self.delay = delay
        self.jitter = jitter
        self.calls = 0
        policy = RobotFileParser()
        policy.parse(reader(HOST + "/robots.txt", limit=200_000).splitlines())
        self.policy = policy

    def get(self, url):
        if not self.policy.can_fetch(AGENT, url):
            raise PermissionError("Robots disallows URL")
        if self.calls:
            self.delay(self.jitter(5.0, 10.0))
        text = self.reader(url)
        self.calls += 1
        return text


def init_db(con):
    con.executescript("""
      CREATE TABLE IF NOT EXISTS run_settings(
        key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pages(
        page_number INTEGER PRIMARY KEY, seen_at TEXT NOT NULL,
        reported_total INTEGER NOT NULL, count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS candidates(
        source_listing_id TEXT PRIMARY KEY, title TEXT NOT NULL,
        source_url TEXT NOT NULL, qualification_group TEXT NOT NULL,
        first_page INTEGER NOT NULL, outcome TEXT,
        reason TEXT, detail_json TEXT);
    """)


def is_zh(item):
    place = item.get("job_location")
    places = place if isinstance(place, list) else [place]
    return any(isinstance(p, dict) and
               str(p.get("region") or "").strip().upper() == "ZH" and
               str(p.get("country") or "").strip().upper() == "CH" and
               bool(p.get("city")) for p in places)


def accepted(item):
    title = str(item.get("title") or "").upper()
    basic = ("EFZ" in title.split() or "EBA" in title.split())
    if not basic or not is_zh(item):
        return False, "qualification_or_canton_mismatch"
    start = item.get("job_start_date")
    if not isinstance(start, str) or start[:4] not in ("2027", "2028"):
        return False, "missing_or_unexpected_start_year"
    if not item.get("company"):
        return False, "missing_employer"
    return True, None


def run(path, *, target=200, max_pages=40, max_details=250, client=None,
        commit_test_db=False):
    if not 1 <= target <= 200 or not 1 <= max_pages <= 40 or not 1 <= max_details <= 250:
        raise ValueError("Pilot limits: target <= 200, pages <= 40, details <= 250")
    client = client or PoliteClient()
    counts = {"pages_added": 0, "details_attempted": 0, "accepted": 0,
              "rejected": 0, "skipped": 0, "stopped": None, "committed": 0}
    with sqlite3.connect(path) as con:
        init_db(con)
        mode = "test_db_commit" if commit_test_db else "local_staging_only"
        saved_mode = con.execute(
            "SELECT value FROM run_settings WHERE key='mode'").fetchone()
        if saved_mode is not None and saved_mode[0] != mode:
            raise ValueError("Checkpoint belongs to another import mode; choose a separate file")
        with con:
            con.execute("INSERT OR IGNORE INTO run_settings VALUES ('mode',?)", (mode,))
        # Discover through the dedicated canton filter; no country-wide search.
        for page in range(1, max_pages + 1):
            if con.execute("SELECT 1 FROM pages WHERE page_number=?", (page,)).fetchone():
                continue
            try:
                result = extract_jsonld_listings(client.get(search_url(page)))
                records = result["records"]
                if not records or result["invalid_entries"] or result["reported_total"] is None:
                    raise ValueError("Empty or malformed filtered search page")
                with con:
                    for item in records:
                        con.execute("""INSERT OR IGNORE INTO candidates
                            (source_listing_id,title,source_url,qualification_group,first_page)
                            VALUES (?,?,?,?,?)""",
                            (item["source_listing_id"], item["title"], item["source_url"],
                             item["qualification_group"], page))
                    con.execute("INSERT INTO pages VALUES (?,?,?,?)",
                                (page, datetime.now(timezone.utc).isoformat(),
                                 result["reported_total"], len(records)))
                counts["pages_added"] += 1
            except (HTTPError, URLError, TimeoutError, ValueError, PermissionError, OSError) as exc:
                counts["stopped"] = f"discovery:{type(exc).__name__}"
                return counts
            # Don't scan excess pages when plenty of leads have been discovered.
            pending = con.execute("""SELECT COUNT(*) FROM candidates
                WHERE outcome IS NULL AND qualification_group='basic_efz_eba'""").fetchone()[0]
            good = con.execute("SELECT COUNT(*) FROM candidates WHERE outcome='accepted'").fetchone()[0]
            if good + pending >= target + 25:
                break

        rows = con.execute("""SELECT source_listing_id,source_url FROM candidates
          WHERE outcome IS NULL AND qualification_group='basic_efz_eba'
          ORDER BY first_page, rowid""").fetchall()
        db_conn = None
        try:
            if commit_test_db:
                import psycopg
                db_conn = psycopg.connect(dbname="careeragency_test", connect_timeout=5,
                                          autocommit=True, options="-c statement_timeout=15000")
            for source_id, url in rows:
                if counts["details_attempted"] >= max_details:
                    break
                good = con.execute("SELECT COUNT(*) FROM candidates WHERE outcome='accepted'").fetchone()[0]
                if good >= target:
                    break
                counts["details_attempted"] += 1
                try:
                    detail = extract_detail(client.get(url))
                    if detail["source_listing_id"] != source_id:
                        raise ValueError("Mismatching source ID")
                    ok, reason = accepted(detail)
                    if ok:
                        normalized = normalize(detail)
                        # POC SQL has limited fields: a complete audit record is
                        # retained in local SQLite, not silently inferred in SQL.
                        if db_conn is not None:
                            store(db_conn, normalized, commit=True)
                            counts["committed"] += 1
                        with con:
                            con.execute("""UPDATE candidates SET outcome='accepted',
                              reason=NULL,detail_json=? WHERE source_listing_id=?""",
                              (json.dumps(detail, ensure_ascii=False), source_id))
                        counts["accepted"] += 1
                    else:
                        with con:
                            con.execute("UPDATE candidates SET outcome='rejected',reason=? WHERE source_listing_id=?",
                                        (reason, source_id))
                        counts["rejected"] += 1
                except HTTPError as exc:
                    counts["stopped"] = f"detail:http_{exc.code}"
                    break
                except (URLError, TimeoutError, ValueError, PermissionError, OSError) as exc:
                    counts["stopped"] = f"detail:{type(exc).__name__}"
                    break
        finally:
            if db_conn is not None:
                db_conn.close()
        counts["total_accepted"] = con.execute(
            "SELECT COUNT(*) FROM candidates WHERE outcome='accepted'").fetchone()[0]
        counts["total_candidates"] = con.execute(
            "SELECT COUNT(*) FROM candidates").fetchone()[0]
    return counts


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--checkpoint", type=Path, default=Path("/tmp/yousty-zh-200.sqlite3"))
    cli.add_argument("--target", type=int, default=200)
    cli.add_argument("--max-pages", type=int, default=40)
    cli.add_argument("--max-details", type=int, default=250)
    cli.add_argument("--commit-test-db", action="store_true")
    args = cli.parse_args()
    result = run(args.checkpoint, target=args.target, max_pages=args.max_pages,
                 max_details=args.max_details, commit_test_db=args.commit_test_db)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
