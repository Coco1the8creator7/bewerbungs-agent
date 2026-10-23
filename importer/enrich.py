"""Conservative, dependency-free extraction of public JobPosting descriptions."""
import html
from html.parser import HTMLParser
import ipaddress
import socket
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, urlopen

MAX_BYTES = 2_000_000
MAX_REDIRECTS = 5

def _public_address(url):
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    if parsed.username or parsed.password or parsed.port not in (None, 80, 443):
        return False
    host = parsed.hostname.lower().rstrip(".")
    if host == "localhost" or host.endswith(".localhost") or "." not in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    try:
        addresses = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        return bool(addresses) and all(ipaddress.ip_address(a[4][0]).is_global for a in addresses)
    except (socket.gaierror, ValueError):
        return False

class _SafeRedirect(HTTPRedirectHandler):
    def __init__(self):
        self.redirects = 0
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.redirects += 1
        if self.redirects > MAX_REDIRECTS or not _public_address(newurl):
            raise ValueError("unsafe_redirect")
        return super().redirect_request(req, fp, code, msg, headers, newurl)

class _Markup(HTMLParser):
    """Extract JSON-LD blocks and basic text from their HTML description values."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_script = False
        self.script = []
        self.blocks = []
    def handle_starttag(self, tag, attrs):
        if tag == "script":
            typ = dict(attrs).get("type", "").lower()
            self.in_script = typ == "application/ld+json"
            if self.in_script:
                self.script = []
    def handle_data(self, data):
        if self.in_script:
            self.script.append(data)
    def handle_endtag(self, tag):
        if tag == "script" and self.in_script:
            self.blocks.append("".join(self.script))
            self.in_script = False

class _Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.ignored = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "footer"):
            self.ignored += 1
        if not self.ignored and tag in ("p", "li", "br", "h1", "h2", "h3", "h4", "div"):
            self.parts.append("\n")
    def handle_data(self, data):
        if not self.ignored:
            self.parts.append(data)
    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "footer"):
            self.ignored = max(0, self.ignored - 1)
        if not self.ignored and tag in ("p", "li", "h1", "h2", "h3", "h4", "div"):
            self.parts.append("\n")

def clean_description(value):
    if not isinstance(value, str):
        return None
    parser = _Text()
    parser.feed(html.unescape(value))
    lines = [" ".join(line.split()) for line in "".join(parser.parts).splitlines()]
    result = "\n".join(line for line in lines if line)
    return result if 250 <= len(result) <= 30000 else None

def _candidates(obj):
    if isinstance(obj, list):
        for item in obj:
            yield from _candidates(item)
    elif isinstance(obj, dict):
        typ = obj.get("@type", "")
        types = typ if isinstance(typ, list) else [typ]
        if any(isinstance(t, str) and t.rsplit("/", 1)[-1].casefold() == "jobposting" for t in types):
            yield obj
        for key in ("@graph", "mainEntity"):
            if key in obj:
                yield from _candidates(obj[key])

def _identity_matches(job, posting):
    expected = set(re.findall(r"[\wÀ-ÿ]+", str(job.get("title") or "").casefold()))
    given = set(re.findall(r"[\wÀ-ÿ]+", str(posting.get("title") or posting.get("name") or "").casefold()))
    if not expected or not given:
        return False
    # Require overlap to avoid importing a different offer on search/landing pages.
    return len(expected & given) / max(1, min(len(expected), len(given))) >= 0.6

def parse_jobposting(html_source, job):
    try:
        posting = single_posting(html_source)
    except ValueError:
        return None
    if not _identity_matches(job, posting):
        return None
    return {"description": clean_description(posting["description"]), "method": "jsonld_jobposting"}

def enrich_one(job, fetch=None):
    if job.get("description") or not job.get("url"):
        return job, "already_present" if job.get("description") else "missing_url"
    url = job["url"]
    if not _public_address(url):
        return job, "invalid_url"
    try:
        if fetch is not None:
            source = fetch(url)
        else:
            source, final_url = fetch_page(url)
        parsed = parse_jobposting(source, job)
        if not parsed:
            return job, "no_matching_jobposting"
        updated = dict(job)
        updated["description"] = parsed["description"]
        updated["description_source"] = parsed["method"]
        if fetch is None:
            from importer.pipeline import canonical_url
            final_url = canonical_url(final_url)
            if final_url != canonical_url(url):
                updated["url_aliases"] = sorted(set(job.get("url_aliases", [])) | {final_url})
        return updated, "enriched"
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, UnicodeError) as exc:
        return job, "http_error" if not isinstance(exc, ValueError) else "invalid_redirect"

def enrich_jobs(jobs, max_jobs=15):
    """Bounded retry; existing data and stable IDs remain untouched."""
    from collections import Counter
    outcomes = Counter()
    updated = []
    attempts = 0
    for job in jobs:
        if not job.get("description") and job.get("url") and attempts < max_jobs:
            attempts += 1
            next_job, outcome = enrich_one(job)
        else:
            next_job, outcome = job, "already_present" if job.get("description") else "skipped_limit"
        updated.append(next_job)
        outcomes[outcome] += 1
    return updated, dict(outcomes)

def fetch_page(url):
    """Same bounded, redirect-checked HTTP fetch for both input adapters."""
    from urllib.request import build_opener
    if not _public_address(url):
        raise ValueError("invalid_url")
    opener = build_opener(_SafeRedirect())
    req = Request(url, headers={"User-Agent": "BewerbungsAgent/0.1", "Accept": "text/html"})
    with opener.open(req, timeout=8) as response:
        final = response.geturl()
        if not _public_address(final):
            raise ValueError("invalid_redirect")
        if "text/html" not in response.headers.get("Content-Type", "").lower():
            raise ValueError("not_html")
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("too_large")
        return data.decode(response.headers.get_content_charset() or "utf-8", "replace"), final

def single_posting(source):
    """Never pick an arbitrary job from a search results page."""
    parser = _Markup()
    parser.feed(source)
    candidates = []
    for block in parser.blocks:
        try:
            for item in _candidates(json.loads(block)):
                if item not in candidates:
                    candidates.append(item)
        except (ValueError, TypeError):
            continue
    if len(candidates) != 1:
        raise ValueError("missing_or_ambiguous_jobposting")
    posting = candidates[0]
    if not isinstance(posting.get("title"), str) or not posting["title"].strip():
        raise ValueError("missing_title")
    if not clean_description(posting.get("description")):
        raise ValueError("missing_description")
    return posting

def backfill_descriptions(jobs, cursor=None, max_jobs=8, skip_ids=()):
    """Retry previously imported jobs in stable round-robin order, without dropping user state.

    Each run visits a different bounded segment of missing descriptions. The cursor
    is an ID rather than a row offset so new jobs do not restart the backlog.
    """
    from bisect import bisect_right
    from collections import Counter

    if max_jobs < 0:
        raise ValueError("negative_backfill_limit")
    excluded = set(skip_ids)
    candidates = sorted((job["id"], index) for index, job in enumerate(jobs)
                        if job.get("url") and not job.get("description") and job["id"] not in excluded)
    if not candidates or max_jobs == 0:
        return jobs, cursor, {"attempted": 0, "enriched": 0, "outcomes": {}}

    keys = [job_id for job_id, _ in candidates]
    start = bisect_right(keys, cursor or "")
    batch = (candidates[start:] + candidates[:start])[:max_jobs]
    result = list(jobs)
    counts = Counter()
    for job_id, index in batch:
        result[index], outcome = enrich_one(result[index])
        counts[outcome] += 1
    return result, batch[-1][0], {
        "attempted": len(batch),
        "enriched": counts.pop("enriched", 0),
        "outcomes": dict(counts)
    }
