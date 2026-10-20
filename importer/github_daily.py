"""GitHub Actions Gmail jobmail import; publishes ONLY public job listing fields.
Requires Gmail OAuth refresh-token secrets. No third-party packages.
The output dashboard/jobs.json is PUBLIC if Pages/repository is public.
"""
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import time
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from html.parser import HTMLParser
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from importer.normalize import make_job

OUT = Path("dashboard/jobs.json")
STATE = Path("importer/import-state.json")
MAX_WORKERS = 5
MAX_MESSAGES = 500
PARSER_VERSION = 2 # Bump when improved extraction requires historical reprocessing.
ADDRESSES = {"jobmail@jobs.ch": "jobs.ch", "no-reply@publicjobs.ch": "publicjobs.ch",
             "no-reply.ewz@solique.ch": "ewz", "e-recruiting@energie360.ch": "energie360.ch"}
DETAIL = re.compile(r"https?://(?:www\.)?jobs\.ch/(?:de|fr|it)/stellenangebote/detail/([0-9a-f-]{36})/",re.I)
PUBLIC = re.compile(r"https?://opn\.publicjobs\.ch/jmultn/([a-zA-Z0-9]+)",re.I)
MDLINK = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")
CATEGORIES = {
    "Fernwärme": ["fernwärme", "wärmenetz", "thermische netze", "nahwärme"],
    "Energiekonzept": ["energiekonzept", "energiesystem", "energiecontrolling"],
    "Projektleitung": ["projektleit", "projektmanager"],
    "Energieberatung": ["energieberat"],
    "Erneuerbare Energien": ["erneuerbar", "wärmepumpe", "energieingenieur"],
    "Fachbereich Energie": ["energie", "umweltingenieur"],
}
class MailTextParser(HTMLParser):
    """Turn an HTML-only job alert into a link-preserving, line-based text view."""
    BLOCKS={"p","div","section","article","tr","td","li","br","h1","h2","h3"}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts=[]
        self.href=None
        self.anchor=[]
        self.ignored=0
    def handle_starttag(self,tag,attrs):
        if tag in ("style","script"): self.ignored+=1
        if self.ignored: return
        if tag in self.BLOCKS:self.parts.append("\n")
        if tag=="a" and self.href is None:
            self.href=dict(attrs).get("href")
            self.anchor=[]
    def handle_data(self,data):
        if self.ignored:return
        if self.href is not None:self.anchor.append(data)
        else:self.parts.append(data)
    def handle_endtag(self,tag):
        if tag in ("style","script"):
            self.ignored=max(0,self.ignored-1)
            return
        if self.ignored:return
        if tag=="a" and self.href is not None:
            label=" ".join(" ".join(self.anchor).split())
            if label:self.parts.append("["+label+"]("+self.href+")")
            self.href=None;self.anchor=[]
        if tag in self.BLOCKS:self.parts.append("\n")
    def text(self):
        return "".join(self.parts)

def request_json(url, method="GET", data=None, token=None):
    body=urlencode(data).encode() if data is not None else None
    req=Request(url,data=body,method=method,headers={"Accept":"application/json",**({"Authorization":"Bearer "+token} if token else {})})
    try:
        with urlopen(req,timeout=35) as response:
            return json.load(response)
    except HTTPError as exc:
        if url.startswith("https://oauth2.googleapis.com/token"):
            # Report Google's structured error code, never echo token or secret.
            try:
                data=json.loads(exc.read(4096).decode("utf-8"))
                code=str(data.get("error","unknown_error"))
                if code not in ("invalid_client","invalid_grant","unauthorized_client","invalid_request","access_denied"):
                    code="oauth_error"
            except (ValueError,UnicodeError):
                code="oauth_error"
            raise RuntimeError("Google OAuth Tokenfehler: "+code+" (HTTP "+str(exc.code)+")") from None
        raise

def access_token():
    keys=("GMAIL_CLIENT_ID","GMAIL_CLIENT_SECRET","GMAIL_REFRESH_TOKEN")
    missing=[k for k in keys if not os.environ.get(k)]
    if missing: raise RuntimeError("Fehlende GitHub Actions Secrets: "+", ".join(missing))
    result=request_json("https://oauth2.googleapis.com/token","POST",
        {"client_id":os.environ[keys[0]],"client_secret":os.environ[keys[1]],
         "refresh_token":os.environ[keys[2]],"grant_type":"refresh_token"})
    if not result.get("access_token"): raise RuntimeError("OAuth: kein Zugriffstoken erhalten")
    return result["access_token"]

def search_after():
    """Use 48h overlap, not a complete 30d rescan; persist only UTC time."""
    if not STATE.exists():
        return (datetime.now(timezone.utc)-timedelta(days=90)).strftime("%Y/%m/%d")
    data=json.loads(STATE.read_text(encoding="utf-8"))
    if data.get("parser_version") != PARSER_VERSION:
        return (datetime.now(timezone.utc)-timedelta(days=90)).strftime("%Y/%m/%d")
    stamp=datetime.fromisoformat(data["last_success_utc"])
    if stamp.tzinfo is None:
        raise ValueError("Import state needs timezone")
    return (stamp.astimezone(timezone.utc)-timedelta(days=2)).strftime("%Y/%m/%d")

def fetch_message(token, item):
    raw=request_json("https://gmail.googleapis.com/gmail/v1/users/me/messages/"+item["id"]+"?format=raw",token=token)
    msg=BytesParser(policy=policy.default).parsebytes(base64.urlsafe_b64decode(raw["raw"]+"="*(-len(raw["raw"])%4)))
    from email.utils import parseaddr
    platform=ADDRESSES.get(parseaddr(str(msg.get("From","")))[1].lower())
    if not platform:
        return None
    texts=[];htmls=[]
    for part in (msg.walk() if msg.is_multipart() else [msg]):
        if part.get_content_disposition()=="attachment": continue
        try:
            if part.get_content_type()=="text/plain":texts.append(str(part.get_content()))
            if part.get_content_type()=="text/html":htmls.append(str(part.get_content()))
        except (UnicodeError,LookupError):continue
    received=datetime.fromtimestamp(int(raw["internalDate"])/1000,timezone.utc).isoformat()
    return platform,str(msg.get("Subject","")), "\n".join(texts), "\n".join(htmls),received

def gmail_messages(token, after=None):
    """Bounded pagination and up to five simultaneous raw-message requests."""
    page=None; count=0
    cutoff=after or search_after()
    query="after:"+cutoff+" (from:jobmail@jobs.ch OR from:no-reply@publicjobs.ch OR from:no-reply.ewz@solique.ch OR from:e-recruiting@energie360.ch)"
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        while True:
            params={"q":query,"maxResults":100}
            if page:params["pageToken"]=page
            result=request_json("https://gmail.googleapis.com/gmail/v1/users/me/messages?"+urlencode(params),token=token)
            items=result.get("messages",[])
            remaining=MAX_MESSAGES-count
            if remaining<=0:
                raise RuntimeError("Import exceeds safe maximum of 500 messages; increase limit or reduce scan period")
            if len(items)>remaining:
                raise RuntimeError("Import exceeds safe maximum of 500 messages; stop without advancing cursor")
            count+=len(items)
            print(f"Gmail: {count} message references discovered",flush=True)
            for message in pool.map(lambda item: fetch_message(token,item),items):
                if message is not None:yield message
            page=result.get("nextPageToken")
            if not page:return

def _message_body(text, html):
    # Gmail raw text/plain is not necessarily Markdown; the HTML part contains
    # reliable title links and visual company/location lines.
    if MDLINK.search(text):
        return text
    if html:
        parser=MailTextParser()
        parser.feed(html)
        return parser.text()
    return text

def _publicjobs_body(text):
    """Ignore the marketing footer: it also uses /jmultn/ tracking links."""
    start = re.search(r"(?:Wir haben neue, passende Jobs für dich gefunden|Neue passende Jobs für dich)", text, re.I)
    if start:
        text = text[start.end():]
    end = re.search(r"(?:Wir wünschen dir viel Erfolg|Herzliche Grüsse|PS:\s*Lust auf mehr)", text, re.I)
    if end:
        text = text[:end.start()]
    return text

def _metadata(text, title, url, platform):
    """Company/location follow the title link in the actual jobs.ch/publicjobs mail layout."""
    marker = "[" + title + "](" + url + ")"
    offset = text.find(marker)
    if offset < 0:
        return None, None
    tail = text[offset + len(marker):]
    # The next Markdown link starts another offer (or footer), not metadata.
    tail = tail.split("[", 1)[0]
    lines = [x.strip() for x in tail.splitlines() if x.strip()]
    if not lines:
        return None, None
    candidate = lines[0]
    if len(candidate) > 180 or candidate.lower().startswith(("http", "company logo")):
        return None, None
    if platform == "publicjobs.ch" and " - " in candidate:
        return tuple(x.strip() for x in candidate.rsplit(" - ", 1))
    if platform == "jobs.ch" and ", " in candidate:
        return tuple(x.strip() for x in candidate.rsplit(", ", 1))
    return candidate, None

def _generic_offer(platform, title, url):
    """Conservative URL-based extraction for employer mail layouts not yet observed."""
    from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit
    try:
        parsed = urlsplit(url.strip())
    except ValueError:
        return None
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None
    host = parsed.hostname.lower()
    path = parsed.path.lower()
    label = title.strip()
    if len(label) < 7 or len(label) > 190:
        return None
    navigation = ("abmelden", "unsubscribe", "datenschutz", "privacy", "impressum",
                  "kontakt", "contact", "linkedin", "instagram", "tiktok", "job alert",
                  "alle jobs", "alle stellen", "stellenangebote ansehen", "jobmail",
                  "karriere", "career", "mehr erfahren", "logo", "jetzt bewerben")
    if any(label.casefold() == n for n in navigation):
        return None
    # A concrete job path/slug is necessary; generic career and search homepages
    # should not create fake job entries. Candidate URLs retain useful job ids.
    signal = re.search(r"(job|stellen|vacanc|position|recruit|career|karriere|bewerb|talent|angebot)", host + path, re.I)
    concrete = re.search(r"(?:/|=)(?:[0-9]{4,}|[0-9a-f]{8}-[0-9a-f-]{20,}|[a-z0-9-]{8,})(?:/|$)", path, re.I)
    if not signal or not concrete:
        return None
    safe_query = urlencode([(k,v) for k,v in parse_qsl(parsed.query,keep_blank_values=True)
                             if not (k.lower().startswith("utm_") or k.lower() in ("uid","mid","mc_cid","mc_eid"))])
    clean = urlunsplit((parsed.scheme.lower(),host,path.rstrip("/"),safe_query,""))
    return clean, hashlib.sha256(clean.encode()).hexdigest()[:32]

def listings(platform,subject,text,html,received):
    if re.search(r"aktivier|bestätig|confirm|anmeldung|passwort",subject,re.I):
        return []
    body = _message_body(text,html)
    if platform == "publicjobs.ch":
        body = _publicjobs_body(body)
    links = MDLINK.findall(body)
    # When HTML is present but the plain body isn't, restrict to real job links by URL.
    results = []
    seen = set()
    for title,url in links:
        title = " ".join(title.split())
        if len(title) < 6 or title.casefold() in ("company logo","jobs.ch","jobs suchen",
                "neue jobs anzeigen","instagram","linkedin","tiktok","publicjobs.ch"):
            continue
        if platform == "jobs.ch":
            m = DETAIL.search(url)
            if not m: continue
            key = m.group(1).lower()
            canonical = "https://www.jobs.ch/de/stellenangebote/detail/" + key + "/"
        elif platform == "publicjobs.ch":
            m = PUBLIC.search(url)
            if not m or re.search(r"abbestell|jobmail|jobs suchen|social|instagram|linkedin|tiktok",title,re.I):
                continue
            key = m.group(1)
            canonical = "https://opn.publicjobs.ch/jmultn/" + key
        elif platform in ("ewz","energie360.ch"):
            extracted = _generic_offer(platform,title,url)
            if not extracted: continue
            canonical,key = extracted
        else:
            continue
        if canonical in seen: continue
        seen.add(canonical)
        company,location = _metadata(body,title,url,platform)
        results.append(make_job(platform,key,canonical,title,company,location,received))
    return results

def merge(previous, incoming):
    from importer.pipeline import merge_jobs
    return merge_jobs(previous, incoming)[0]

def write_state(timestamp):
    STATE.parent.mkdir(parents=True,exist_ok=True)
    STATE.write_text(json.dumps({"last_success_utc":timestamp.isoformat(),"parser_version":PARSER_VERSION},indent=2)+"\n",encoding="utf-8")

def run():
    started=time.monotonic()
    # Capture before remote queries: no messages can be lost between scan and cursor.
    started_utc=datetime.now(timezone.utc)
    cutoff=search_after()
    print("Gmail scan starting (after "+cutoff+"); concurrency "+str(MAX_WORKERS),flush=True)
    token=access_token()
    previous=json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else []
    if not isinstance(previous,list):raise RuntimeError("Existing JSON is not a list")
    found=[];messages=0
    for record in gmail_messages(token,cutoff):
        messages+=1
        extracted=listings(*record)
        print(f"Quelle {record[0]}: {len(extracted)} Stellenlinks; Nachrichtentitel: {record[1][:70]}",flush=True)
        found.extend(extracted)
    from importer.pipeline import process, validate_public
    combined, outcomes = process(previous, found)
    validate_public(combined)
    print("Pipeline:", json.dumps(outcomes), flush=True)
    # Avoid overwriting a useful list if transient Gmail query yields nothing.
    if not messages and not previous:raise RuntimeError("Keine Jobmails gefunden; Initialimport abgebrochen")
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(combined,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    write_state(started_utc)
    print(f"Nachrichten gelesen: {messages}; Stellenlinks erkannt: {len(found)}; Dashboard-Datensätze: {len(combined)}; Laufzeit: {time.monotonic()-started:.1f}s",flush=True)
if __name__=="__main__":
    try:run()
    except Exception as exc:
        print("Import fehlgeschlagen: "+str(exc),file=sys.stderr);raise
