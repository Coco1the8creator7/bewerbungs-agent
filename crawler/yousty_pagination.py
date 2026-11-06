"""Bounded, resumable Yousty pagination pilot.

One request at a time, at most five new result pages per run.
Stops on HTTP errors and robots denial; never touches production.
"""
import argparse
from datetime import datetime, timezone
import json
import random
import sqlite3
import time
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser
from urllib.error import HTTPError, URLError

from crawler.yousty_jsonld import extract_jsonld_listings

BASE = "https://www.yousty.ch"
AGENT = "CareerAgencyPaginationPilot/0.1 (careeragency.ch)"


def page_url(n):
    if n < 1:
        raise ValueError("invalid page number")
    return f"{BASE}/de-CH/lehrstellen/?locale=de-CH&page={n}"


def _read(url, limit=2_000_000):
    with urlopen(Request(url, headers={"User-Agent": AGENT, "Accept": "text/html"}), timeout=20) as response:
        final = urlsplit(response.geturl())
        if final.scheme != "https" or final.hostname != "www.yousty.ch":
            raise ValueError("unexpected redirect")
        if response.status != 200:
            raise ValueError("unexpected status")
        raw = response.read(limit + 1)
        if len(raw) > limit:
            raise ValueError("response too large")
        return raw.decode("utf-8", "replace")


def robots_policy():
    text = _read(BASE + "/robots.txt", limit=200_000)
    policy = RobotFileParser()
    policy.parse(text.splitlines())
    return policy


def init_db(con):
    con.executescript("""
        CREATE TABLE IF NOT EXISTS pages (
            page_number INTEGER PRIMARY KEY,
            seen_at TEXT NOT NULL,
            result_count INTEGER NOT NULL,
            reported_total INTEGER
        );
        CREATE TABLE IF NOT EXISTS listings (
            source_listing_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            source_url TEXT NOT NULL,
            qualification_group TEXT NOT NULL,
            first_page INTEGER NOT NULL
        );
    """)


def scan(db, start_page=1, max_pages=5, min_delay=5.0, max_delay=10.0,
         reader=_read, policy=None, sleeper=time.sleep, random_delay=random.uniform):
    if start_page < 1 or not 1 <= max_pages <= 5:
        raise ValueError("pilot limited to 1–5 pages")
    if min_delay < 5 or max_delay > 10 or min_delay > max_delay:
        raise ValueError("delay must stay within 5–10 seconds")
    if policy is None:
        policy = robots_policy()
    stats = {"saved_pages": 0, "already_saved": 0, "unique_listings": 0, "stopped": None}
    completed_fetches = 0
    with sqlite3.connect(db) as con:
        init_db(con)
        for page in range(start_page, start_page + max_pages):
            if con.execute("SELECT 1 FROM pages WHERE page_number=?", (page,)).fetchone():
                stats["already_saved"] += 1
                continue
            url = page_url(page)
            if not policy.can_fetch(AGENT, url):
                stats["stopped"] = "robots_disallow"
                break
            if completed_fetches:
                sleeper(random_delay(min_delay, max_delay))
            try:
                data = extract_jsonld_listings(reader(url))
                records = data["records"]
                if not records or data["invalid_entries"]:
                    raise ValueError("empty or invalid page")
                with con:
                    for job in records:
                        con.execute("""INSERT OR IGNORE INTO listings
                            (source_listing_id,title,source_url,qualification_group,first_page)
                            VALUES (?,?,?,?,?)""",
                            (job["source_listing_id"], job["title"], job["source_url"],
                             job["qualification_group"], page))
                    con.execute("INSERT INTO pages VALUES (?,?,?,?)",
                        (page, datetime.now(timezone.utc).isoformat(),
                         len(records), data["reported_total"]))
                stats["saved_pages"] += 1
                completed_fetches += 1
            except HTTPError as exc:
                stats["stopped"] = f"http_{exc.code}"
                break
            except (URLError, OSError, TimeoutError, ValueError) as exc:
                stats["stopped"] = type(exc).__name__
                break
        stats["unique_listings"] = con.execute("SELECT COUNT(*) FROM listings").fetchone()[0]
    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=Path("/tmp/yousty-pagination-pilot.sqlite3"))
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--max-pages", type=int, default=5)
    args = parser.parse_args()
    print(json.dumps(scan(args.db, args.start_page, args.max_pages), indent=2))


if __name__ == "__main__":
    main()
