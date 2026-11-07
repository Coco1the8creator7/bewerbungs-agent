"""Export validated Yousty POC facts to a standalone PRIVATE static demo page.

Read-only access to careeragency_test and to the ZH batch checkpoint.
No network calls, no schema modifications, no publication and no full scraped
descriptions. Place output outside the public webroot; expose only behind
server-side access control after reviewing the Caddy configuration.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from html import escape
from pathlib import Path
import json
import os
import re
import sqlite3
from urllib.parse import urlsplit

EXPECTED_DB = "careeragency_test"
PROFILE_RE = re.compile(r"/de-CH/lehrstellen/profile/([0-9]+)(?:-[^/?#]*)?/?\Z")


def verified_profile_url(url: str, listing_id: str) -> bool:
    if not isinstance(url, str) or not isinstance(listing_id, str):
        return False
    try:
        parsed = urlsplit(url)
        match = PROFILE_RE.fullmatch(parsed.path)
        return bool(
            parsed.scheme == "https" and parsed.hostname == "www.yousty.ch"
            and parsed.port in (None, 443) and parsed.username is None
            and parsed.password is None and not parsed.query and not parsed.fragment
            and match and match.group(1) == listing_id
        )
    except ValueError:
        return False


def accepted_ids(checkpoint: Path) -> set[str]:
    if not checkpoint.is_file():
        raise ValueError("Missing ZH checkpoint; will not export unverified rows")
    uri = f"file:{checkpoint.resolve().as_posix()}?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=5) as conn:
        rows = conn.execute(
            "SELECT source_listing_id, detail_json FROM candidates WHERE outcome='accepted'"
        ).fetchall()
    verified = set()
    for listing_id, raw in rows:
        if not raw:
            raise ValueError("Accepted listing without validated detail")
        detail = json.loads(raw)
        if detail.get("source_listing_id") != listing_id:
            raise ValueError("Checkpoint ID mismatch")
        loc = detail.get("job_location")
        locations = loc if isinstance(loc, list) else [loc]
        zh = any(
            isinstance(place, dict)
            and str(place.get("region") or "").upper() == "ZH"
            and str(place.get("country") or "").upper() == "CH"
            and bool(place.get("city"))
            for place in locations
        )
        if not zh:
            raise ValueError("Checkpoint contains an accepted non-ZH listing")
        title = str(detail.get("title") or "").upper().split()
        if not ("EFZ" in title or "EBA" in title):
            raise ValueError("Checkpoint contains an accepted non-EFZ/EBA offer")
        verified.add(str(listing_id))
    if not verified:
        raise ValueError("No validated Zurich records in checkpoint")
    return verified


def collect_records(conn, allowed: set[str]) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(), current_user")
        db_name, db_user = cur.fetchone()
        if (db_name, db_user) != (EXPECTED_DB, "careeragency_test"):
            raise RuntimeError("Only the restricted isolated test database is permitted")
        cur.execute("""
            SELECT l.source_listing_id, l.title, l.company, l.location,
                   l.start_year, l.source_url
            FROM apprenticeship_poc.listings AS l
            JOIN apprenticeship_poc.sources AS s ON s.id=l.source_id
            WHERE s.code='yousty_poc'
            ORDER BY l.company, l.title, l.source_listing_id
        """)
        rows = cur.fetchall()
    records = []
    seen = set()
    for listing_id, title, company, location, year, url in rows:
        listing_id = str(listing_id)
        if listing_id not in allowed:
            continue
        if listing_id in seen:
            raise ValueError("Duplicate Yousty listing ID in test database")
        seen.add(listing_id)
        if (not all(isinstance(v, str) and v.strip() for v in (title, company, location))
                or year not in (2027, 2028) or not verified_profile_url(url, listing_id)):
            raise ValueError(f"Invalid export data for listing {listing_id}")
        records.append({"id": listing_id, "title": title.strip(), "company": company.strip(),
                        "location": location.strip(), "year": year, "url": url})
    missing = allowed - seen
    if missing:
        raise ValueError(f"{len(missing)} accepted checkpoint IDs missing from the test DB")
    return records


def render_page(records: list[dict], timestamp: str) -> str:
    if not records:
        raise ValueError("Refusing to generate an empty demo")
    blocks = []
    for record in records:
        rid = str(record["id"])
        url = record["url"]
        if not verified_profile_url(url, rid):
            raise ValueError("Untrusted link in demo")
        def safe(value):
            return escape(str(value), quote=True)
        blocks.append(
            '<article class="card" data-search="' +
            safe(" ".join(str(record[x]) for x in ("title", "company", "location"))) +
            '" data-year="' + safe(record["year"]) + '">'
            '<div class="meta"><span>' + safe(record["location"]) +
            '</span><span>Lehrbeginn ' + safe(record["year"]) + '</span></div>'
            '<h2>' + safe(record["title"]) + '</h2>'
            '<p class="company">' + safe(record["company"]) + '</p>'
            '<a target="_blank" rel="noopener noreferrer" href="' +
            safe(url) + '">Originalinserat bei Yousty ↗</a>'
            '</article>'
        )
    return """<!doctype html>
<html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Lehrstellen Zürich · Career.Agency Demo</title>
<style>
:root{--ca-bg:#F5F6F7;--ca-paper:#fff;--ca-ink:#262A31;--ca-muted:#636B76;--ca-line:#E1E5E9;--ca-accent:#95516E;--ca-accent-soft:#F7EEF2;font-family:Onest,system-ui,-apple-system,Segoe UI,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--ca-bg);color:var(--ca-ink)}
main{max-width:1160px;margin:0 auto;padding:clamp(20px,4vw,48px)}
header{background:#fff;border:1px solid var(--ca-line);border-radius:15px;padding:24px;margin-bottom:20px}
h1{margin:0;font-size:clamp(1.5rem,3vw,2rem);letter-spacing:-.035em}
header p{color:var(--ca-muted);max-width:790px;line-height:1.55;font-size:.94rem}
.label{color:var(--ca-accent);font-size:.8rem;font-weight:750;margin:0 0 7px}
.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:19px}
input,select{font:inherit;padding:11px 13px;border-radius:10px;border:1px solid var(--ca-line);background:var(--ca-paper);color:var(--ca-ink);min-height:44px}
input{flex:1 1 260px}select{min-width:140px}
output{color:var(--ca-muted);font-size:.85rem}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.card{background:var(--ca-paper);padding:20px;border:1px solid var(--ca-line);border-radius:14px;min-width:0;display:flex;flex-direction:column}
.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:.77rem;color:var(--ca-muted)}
.card h2{font-size:1.03rem;line-height:1.38;letter-spacing:-.015em;margin:17px 0 10px}
.company{color:var(--ca-muted);font-size:.9rem;margin:0 0 16px}
.card a{margin-top:auto;color:var(--ca-accent);font-weight:650;font-size:.85rem;text-decoration:none}
.card a:hover{text-decoration:underline} .card[hidden]{display:none}
.notice{font-size:.8rem;color:var(--ca-muted)}
@media(max-width:980px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){.cards{grid-template-columns:1fr}header{padding:20px}}
</style></head><body><main>
<header><div class="label">Career.Agency · Interne Vorschau</div><h1>Lehrstellen im Kanton Zürich</h1>
<p>Testbestand aus der isolierten Datenbank. Die Verfügbarkeit wurde nicht live bestätigt.
Die Vorschau enthält nur Ausbildungsberuf, Lehrbetrieb, Ort, Lehrbeginnjahr und einen Link
zur Originalquelle. Sie ist keine vollständige oder laufend aktualisierte Stellensuche.</p>
<p class="notice">Datenexport: """ + escape(timestamp) + """ UTC · Quelle: Yousty</p></header>
<div class="controls"><input id="search" type="search" placeholder="Beruf, Lehrbetrieb oder Ort suchen" aria-label="Inserate durchsuchen">
<select id="year" aria-label="Lehrbeginn"><option value="">Alle Lehrjahre</option>
<option value="2027">2027</option><option value="2028">2028</option></select>
<output id="count" aria-live="polite">""" + str(len(records)) + """ Inserate</output></div>
<section class="cards" id="cards" aria-label="Lehrstellen">""" + "\n".join(blocks) + """</section>
</main>
<script>
(function(){
'use strict';
const input=document.getElementById('search'),year=document.getElementById('year'),
cards=[...document.querySelectorAll('.card')],count=document.getElementById('count');
function update(){
 const term=input.value.trim().toLocaleLowerCase('de-CH');
 let shown=0;
 for(const card of cards){
  const ok=(!term||card.dataset.search.toLocaleLowerCase('de-CH').includes(term))
    &&(!year.value||card.dataset.year===year.value);
  card.hidden=!ok;if(ok)shown++;
 }
 count.textContent=shown+' von '+cards.length+' Inseraten';
}
input.addEventListener('input',update);year.addEventListener('change',update);
})();
</script></body></html>"""


def export(checkpoint: Path, output: Path) -> int:
    try:
        import psycopg
    except ImportError as err:
        raise RuntimeError("psycopg 3 required") from err
    allowed = accepted_ids(checkpoint)
    with psycopg.connect(dbname=EXPECTED_DB, connect_timeout=5,
                         options="-c statement_timeout=15000") as conn:
        records = collect_records(conn, allowed)
    document = render_page(records, datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"))
    output.parent.mkdir(parents=True, exist_ok=True)
    # Atomic replace; existing page remains intact if export fails.
    temp = output.with_name(output.name + ".new")
    temp.write_text(document, encoding="utf-8")
    os.chmod(temp, 0o644)
    os.replace(temp, output)
    return len(records)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, default=Path("/tmp/yousty-zh-200.sqlite3"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    n = export(args.checkpoint, args.output)
    print(json.dumps({"exported": n, "output": str(args.output),
                      "scope": "private_preview_only", "source": "yousty_poc"}))


if __name__ == "__main__":
    main()
