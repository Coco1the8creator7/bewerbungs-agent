"""Explicit live integration probe; no writes to the public feed."""
import copy
import json
from pathlib import Path
from importer.manual_urls import listing
from importer.pipeline import process, validate_public

NEW = "https://www.jobs.ch/de/stellenangebote/detail/fa2f1cae-3721-418f-8fd8-49a24629be31/"
KNOWN = "https://www.jobs.ch/de/stellenangebote/detail/5f663686-f185-481e-89b7-3a3453ce6ed7/"
rows = json.loads(Path("dashboard/jobs.json").read_text())
snapshot = copy.deepcopy(rows)
assert not any(j["url"] == NEW for j in rows), "Choose a fresh live fixture"
known = next(j for j in rows if j["url"] == KNOWN)
incoming = [listing(NEW), listing(KNOWN)]
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
