"""One conservative merge/enrichment/scoring pipeline; never replace user state."""
from copy import deepcopy
from difflib import SequenceMatcher
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

# Only identity-bearing query fields are accepted. Never publish token/session URLs.
QUERY_KEYS = {"id", "jobid", "job_id", "job", "vacancyid", "positionid"}
TRACKING = {"gclid", "fbclid", "mc_cid", "mc_eid"}
FILL_FIELDS = ("company", "location", "description", "description_source",
               "published_at", "workload_pct_min", "workload_pct_max")
def canonical_url(url):
    p = urlsplit(url)
    if p.scheme not in ("http", "https") or not p.hostname or p.username or p.password:
        raise ValueError("invalid_url")
    if p.port not in (None, 80, 443):
        raise ValueError("invalid_port")
    host = p.hostname.lower()
    query = []
    for k, v in parse_qsl(p.query, keep_blank_values=True):
        if k.lower().startswith("utm_") or k.lower() in TRACKING:
            continue
        if k.lower() not in QUERY_KEYS or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", v):
            raise ValueError("non_public_query")
        query.append((k, v))
    path = p.path.rstrip("/") or "/"
    match = re.fullmatch(r"/(?:de|fr|it|en)/stellenangebote/detail/([a-f0-9-]{36})", path, re.I)
    if host in ("jobs.ch", "www.jobs.ch") and match:
        return "https://www.jobs.ch/de/stellenangebote/detail/" + match[1].lower() + "/"
    return urlunsplit(("https", host, path, urlencode(sorted(query)), ""))

def identity(url):
    clean = canonical_url(url)
    p = urlsplit(clean)
    if p.hostname == "www.jobs.ch" and "/stellenangebote/detail/" in p.path:
        return "jobs.ch", p.path.rstrip("/").split("/")[-1], clean
    if p.hostname == "opn.publicjobs.ch" and p.path.startswith("/jmultn/"):
        return "publicjobs.ch", p.path.split("/")[-1], clean
    platform = "publicjobs.ch" if p.hostname in ("publicjobs.ch", "www.publicjobs.ch") else p.hostname
    return platform, hashlib.sha256(clean.encode()).hexdigest()[:32], clean

def urls(job):
    result = set()
    for url in [job.get("url")] + job.get("url_aliases", []):
        if url:
            try:
                result.add(canonical_url(url))
            except ValueError:
                pass
    return result

def uncertain(a, b):
    title_a, title_b = (str(x.get("title") or "").casefold() for x in (a,b))
    company_a, company_b = (str(x.get("company") or "").casefold() for x in (a,b))
    ratio = SequenceMatcher(None, title_a, title_b).ratio()
    return bool(title_a and title_b and (ratio >= .9 or
                (company_a and company_a == company_b and ratio >= .6)))

def merge_jobs(previous, incoming):
    rows = deepcopy(previous)
    results = []
    for new in incoming:
        hits = [old for old in rows if old["id"] == new["id"] or
                (old.get("source_job_id") and old.get("source") == new.get("source") and
                 old["source_job_id"] == new.get("source_job_id")) or urls(old) & urls(new)]
        if len(hits) > 1:
            results.append({"id": new["id"], "status": "needs_review", "candidate_ids": [x["id"] for x in hits]})
            continue
        if hits:
            old = hits[0]
            # Immutable id, first_seen, status, matching, notes, feedback and unknown fields.
            for key in FILL_FIELDS:
                if old.get(key) is None and new.get(key) is not None:
                    old[key] = deepcopy(new[key])
            old["last_seen_at"] = max(old.get("last_seen_at") or old["first_seen_at"],
                                      new.get("last_seen_at") or new["first_seen_at"])
            aliases = sorted(urls(old) | urls(new) - {canonical_url(old["url"])})
            aliases = [u for u in aliases if u != canonical_url(old["url"])]
            if aliases:
                old["url_aliases"] = aliases
            results.append({"id": old["id"], "status": "existing"})
            continue
        possible = [old["id"] for old in rows if uncertain(old, new)]
        if possible:
            results.append({"id": new["id"], "status": "needs_review", "candidate_ids": possible})
            continue
        rows.append(deepcopy(new))
        results.append({"id": new["id"], "status": "added"})
    return sorted(rows, key=lambda j: j["first_seen_at"], reverse=True), results

def process(previous, incoming, enrich=True):
    from importer.enrich import enrich_jobs
    from selector.score import apply
    if enrich:
        incoming, _ = enrich_jobs(incoming, max_jobs=10)
    rows, results = merge_jobs(previous, incoming)
    return apply(rows), results

def validate_public(rows):
    """Fail closed: never silently strip or publish unexpected private fields."""
    from jsonschema import Draft202012Validator, FormatChecker
    schema = json.loads(Path("schemas/job.schema.json").read_text())
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    ids = set()
    for row in rows:
        validator.validate(row)
        if row["id"] in ids:
            raise ValueError("duplicate_id")
        ids.add(row["id"])
        if row["provenance"] != dict.fromkeys(("source_message_id", "source_received_at", "alert_name")):
            raise ValueError("private_provenance")
        for url in [row.get("url")] + row.get("url_aliases", []):
            if url:
                canonical_url(url)
