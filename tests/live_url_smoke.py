"""Explicit live integration probe; no writes to the public feed."""
import copy
import json
from pathlib import Path
from importer.manual_urls import listing
from importer.pipeline import process, validate_public

NEW = "https://www.jobs.ch/de/stellenangebote/detail/20f3373e-9bbd-4b09-a333-c324072317f0/"
KNOWN = "https://www.jobs.ch/de/stellenangebote/detail/5f663686-f185-481e-89b7-3a3453ce6ed7/"
rows = json.loads(Path("dashboard/jobs.json").read_text())
snapshot = copy.deepcopy(rows)
assert not any(j["url"] == NEW for j in rows), "Choose a fresh live fixture"
known = next(j for j in rows if j["url"] == KNOWN)
from importer.enrich import fetch_page, _Markup
import re
def diagnostic_fetch(url):
    source, final = fetch_page(url)
    parser = _Markup()
    parser.feed(source)
    print("PAGE_DIAGNOSTIC", json.dumps({"url": url, "bytes":len(source),
          "title":re.findall(r"<title[^>]*>(.*?)</title>", source),
          "scripts":re.findall(r"<script[^>]*>", source)[:20],
          "job_links":list(dict.fromkeys(re.findall(r"https://www.jobs.ch/de/stellenangebote/detail/[a-f0-9-]{36}/", source)))[:8],
          "jsonld":[block[:1200] for block in parser.blocks]}), flush=True)
    return source, final
diagnostic_fetch(KNOWN)
incoming = [listing(NEW, diagnostic_fetch), listing(KNOWN, diagnostic_fetch)]
combined, report = process(rows, incoming, enrich=False)
print("LIVE_RESULTS", json.dumps(report))
assert [r["status"] for r in report] == ["added", "existing"], report
assert report[1]["id"] == known["id"]
assert len(combined) == len(rows) + 1
validate_public(combined)
again, repeated = process(combined, incoming, enrich=False)
assert len(again) == len(combined)
assert all(r["status"] == "existing" for r in repeated)
assert rows == snapshot
print("LIVE_OK new + known + repeat, descriptions and scoring validated; no feed written")
