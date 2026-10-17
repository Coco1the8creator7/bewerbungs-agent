"""Conservative multi-job extraction from job-alert HTML/text.

Generic until actual sender-specific HTML fixtures have been inspected.
Uncertain offers are retained as needs_review; emails with no job signals
are not falsely converted into jobs.
"""
from __future__ import annotations
from dataclasses import dataclass
from email.utils import parseaddr
from html.parser import HTMLParser
from urllib.parse import parse_qs, unquote, urlsplit, urlunsplit, urlencode
import hashlib
import re

KNOWN = {
    "jobmail@jobs.ch": "jobs.ch",
    "no-reply@publicjobs.ch": "publicjobs.ch",
    "no-reply.ewz@solique.ch": "ewz",
    "e-recruiting@energie360.ch": "energie360.ch",
}
JOB_HINT = re.compile(r"(job|jobs|stellen|stelle|vacan|career|karriere|recruit|position|apply|bewerb|detail)", re.I)
IGNORE_HINT = re.compile(r"(unsubscribe|abmelden|abbestellen|datenschutz|privacy|newsletter|login|register|aktivier|confirm|bestätig|preferences|social|facebook|instagram|linkedin\.com/company)", re.I)
ACTIVATION = re.compile(r"(aktivier|bestätig|confirm|verification|passwort|registrier|willkommen|anmeldung)", re.I)
TRACK_KEYS = {"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "mc_cid", "mc_eid", "ref", "source", "campaign"}
WRAPPER_HOSTS = ("google.com", "google.ch", "outlook.com", "safelinks.protection.outlook.com")
@dataclass
class Link:
    url: str
    label: str

class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.url = None
        self.parts = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.url = dict(attrs).get("href")
            self.parts = []
    def handle_data(self, data):
        if self.url:
            self.parts.append(data)
    def handle_endtag(self, tag):
        if tag == "a" and self.url:
            self.links.append(Link(self.url, " ".join(" ".join(self.parts).split())))
            self.url = None
            self.parts = []

def canonicalize(url):
    if not url:
        return None
    url = url.strip().strip("<>")
    if url.startswith("//"):
        url = "https:" + url
    for _ in range(3):
        try:
            p = urlsplit(url)
            if p.scheme.lower() not in ("http", "https") or not p.hostname or p.username or p.password:
                return None
            host = p.hostname.lower()
            qs = parse_qs(p.query)
            if (host in WRAPPER_HOSTS or host.endswith(".safelinks.protection.outlook.com")) and any(k in qs for k in ("url", "u", "q")):
                url = unquote(next(iter(qs.get("url") or qs.get("u") or qs.get("q"))))
                continue
            pairs = [(k, v) for k, v in __import__("urllib.parse", fromlist=["parse_qsl"]).parse_qsl(p.query, keep_blank_values=True)
                     if k.lower() not in TRACK_KEYS and not k.lower().startswith("utm_")]
            return urlunsplit(("https", host + ((":" + str(p.port)) if p.port and p.port != 443 else ""), p.path.rstrip("/") or "/", urlencode(pairs), ""))
        except ValueError:
            return None
    return None

def source_for_sender(sender):
    address = parseaddr(sender)[1].lower()
    return KNOWN.get(address)

def classify(sender, subject, body):
    source = source_for_sender(sender)
    if not source:
        return None
    if ACTIVATION.search(subject or "") and not re.search(r"(neue stellen|job alert|jobmail|stellenangebot)", subject or "", re.I):
        return None
    if not body.strip():
        return None
    return source

def extract(sender, subject, body, html=None):
    source = classify(sender, subject, html or body)
    if source is None:
        return []
    links = Links()
    if html:
        links.feed(html)
    candidates = links.links
    if not candidates:
        candidates = [Link(m.group(0), "") for m in re.finditer(r"https?://[^\s<>'\"]+", body)]
    result = []
    seen = set()
    for l in candidates:
        link = canonicalize(l.url)
        if not link or IGNORE_HINT.search(l.url) or IGNORE_HINT.search(l.label):
            continue
        host = (urlsplit(link).hostname or "").lower()
        plausible = bool(JOB_HINT.search(l.url) or JOB_HINT.search(l.label) or (source in ("ewz", "energie360.ch") and l.label))
        if not plausible:
            continue
        if link in seen:
            continue
        seen.add(link)
        title = re.sub(r"\s+", " ", l.label).strip()
        if not title or len(title) < 5 or title.lower() in {"mehr erfahren", "jetzt bewerben", "zur stelle", "ansehen", "details", "stellenangebot ansehen"}:
            title = None
        result.append({"title": title, "url": link, "source": source})
    return result

def stable_id(source, url, message_id, index):
    basis = source + "|" + (url or f"{message_id}:{index}")
    return "job-" + hashlib.sha256(basis.encode()).hexdigest()[:24]
