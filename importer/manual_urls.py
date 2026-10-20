"""URL input adapter. Public URLs only; receipts contain no user feedback."""
from copy import deepcopy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
from importer.enrich import fetch_page, single_posting, clean_description, _identity_matches
from importer.normalize import make_job
from importer.pipeline import canonical_url, identity, process, urls, validate_public

def listing(url, fetch=fetch_page):
    clean = canonical_url(url)
    source, final = fetch(clean)
    final = canonical_url(final)
    post = single_posting(source)
    platform, key, target = identity(final)
    if identity(clean)[0] in ("jobs.ch", "publicjobs.ch"):
        platform, key, target = identity(clean)
    org = post.get("hiringOrganization") or {}
    company = org.get("name") if isinstance(org, dict) else None
    places = post.get("jobLocation") or {}
    if isinstance(places, list):
        places = places[0] if len(places) == 1 else {}
    address = (places.get("address") or {}) if isinstance(places, dict) else {}
    location = address.get("addressLocality") if isinstance(address, dict) else None
    now = datetime.now(timezone.utc).isoformat()
    job = make_job(platform, key, target, post["title"].strip(),
                   company if isinstance(company,str) else None,
                   location if isinstance(location,str) else None, now)
    job["description"] = clean_description(post["description"])
    job["description_source"] = "jsonld_jobposting"
    job["url_aliases"] = sorted({clean, final} - {target})
    job["processing"]["warnings"] = []
    return job

def import_urls(previous, inputs, fetch=fetch_page):
    if not isinstance(inputs, list) or not 1 <= len(inputs) <= 20 or not all(isinstance(u,str) for u in inputs):
        raise ValueError("expected_1_to_20_urls")
    rows = deepcopy(previous)
    report = []
    unresolved = []
    for old in rows:
        if (old.get("url") or "").startswith("https://opn.publicjobs.ch/jmultn/") and not old.get("url_aliases"):
            unresolved.append(old)
    for old in unresolved[:20]:
        try:
            source, final = fetch(old["url"])
            post = single_posting(source)
            if _identity_matches(old, post):
                alias = canonical_url(final)
                if alias != canonical_url(old["url"]):
                    old["url_aliases"] = [alias]
        except Exception:
            pass
    for index, raw in enumerate(inputs):
        try:
            clean = canonical_url(raw.strip())
            known = [old for old in rows if clean in urls(old)]
            try:
                candidate = listing(clean, fetch)
            except Exception:
                if len(known) == 1:
                    report.append({"index": index, "id": known[0]["id"], "status": "existing", "enrichment": "unavailable"})
                else:
                    report.append({"index": index, "status": "fetch_or_parse_failed"})
                continue
            unknown_legacy = [old["id"] for old in unresolved if not old.get("url_aliases") and
                              (not old.get("company") or not old.get("title"))]
            if candidate["source"] == "publicjobs.ch" and unknown_legacy and not known:
                report.append({"index": index, "status": "needs_review", "candidate_ids": unknown_legacy})
                continue
            rows, outcome = process(rows, [candidate], enrich=False)
            report.append({"index": index, **outcome[0]})
        except (ValueError, TypeError):
            report.append({"index": index, "status": "invalid_url"})
    return rows, report

def main():
    feed = Path("dashboard/jobs.json")
    rows = json.loads(feed.read_text())
    validate_public(rows)
    receipts_dir = Path("importer/url-results")
    receipts_dir.mkdir(parents=True, exist_ok=True)
    requests = []
    direct = os.environ.get("MANUAL_URLS", "").strip()
    if direct:
        requests.append(("dispatch-" + os.environ.get("GITHUB_RUN_ID", "local"),
                         {"urls": [u for u in re.split(r"\s+", direct) if u]}))
    else:
        for path in sorted(Path("importer/url-requests").glob("*.json")):
            if not (receipts_dir / path.name).exists():
                requests.append((path.stem, json.loads(path.read_text())))
    for key, payload in requests[:5]:
        if set(payload) != {"urls"}:
            raise ValueError("request_must_only_contain_urls")
        rows, results = import_urls(rows, payload["urls"])
        validate_public(rows)
        receipt = {"request_id": key, "results": results}
        (receipts_dir / (key + ".json")).write_text(json.dumps(receipt, indent=2) + "\n")
        print(json.dumps(receipt))
    validate_public(rows)
    feed.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")

if __name__ == "__main__":
    main()
