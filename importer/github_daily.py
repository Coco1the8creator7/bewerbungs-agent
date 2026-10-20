"""GitHub Actions Gmail jobmail import; publishes ONLY public job listing fields.
Requires Gmail OAuth refresh-token secrets. No third-party packages.
The output dashboard/jobs.json is PUBLIC if Pages/repository is public.
"""
import base64
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

OUT = Path("dashboard/jobs.json")
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
class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.href=None; self.buf=[]
    def handle_starttag(self, tag, attrs):
        if tag=="a": self.href=dict(attrs).get("href");self.buf=[]
    def handle_data(self, data):
        if self.href: self.buf.append(data)
    def handle_endtag(self, tag):
        if tag=="a" and self.href:
            self.links.append((" ".join(" ".join(self.buf).split()),self.href))
            self.href=None;self.buf=[]

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

def gmail_messages(token):
    page=None; count=0
    # Scan trailing 30d on each run to catch missed runs; store previous jobs in JSON.
    while True:
        params={"q":"newer_than:30d (from:jobmail@jobs.ch OR from:no-reply@publicjobs.ch OR from:no-reply.ewz@solique.ch OR from:e-recruiting@energie360.ch)",
                "maxResults":100}
        if page: params["pageToken"]=page
        result=request_json("https://gmail.googleapis.com/gmail/v1/users/me/messages?"+urlencode(params),token=token)
        for item in result.get("messages",[]):
            raw=request_json("https://gmail.googleapis.com/gmail/v1/users/me/messages/"+item["id"]+"?format=raw",token=token)
            msg=BytesParser(policy=policy.default).parsebytes(base64.urlsafe_b64decode(raw["raw"]+"="*(-len(raw["raw"])%4)))
            sender=str(msg.get("From","")).lower()
            from email.utils import parseaddr
            platform=ADDRESSES.get(parseaddr(sender)[1].lower())
            if not platform: continue
            texts=[];htmls=[]
            for part in (msg.walk() if msg.is_multipart() else [msg]):
                if part.get_content_disposition()=="attachment": continue
                try:
                    if part.get_content_type()=="text/plain": texts.append(str(part.get_content()))
                    if part.get_content_type()=="text/html": htmls.append(str(part.get_content()))
                except (UnicodeError,LookupError): continue
            received=datetime.fromtimestamp(int(raw["internalDate"])/1000,timezone.utc).isoformat()
            yield platform,str(msg.get("Subject","")), "\n".join(texts), "\n".join(htmls),received
            count+=1
            if count>=500: return
        page=result.get("nextPageToken")
        if not page: return

def listings(platform,subject,text,html,received):
    if re.search(r"aktivier|bestätig|confirm|anmeldung|passwort",subject,re.I): return []
    # Plain Gmail connector-style text and real HTML both supported.
    anchors=MDLINK.findall(text)
    if not anchors and html:
        parser=AnchorParser(); parser.feed(html); anchors=parser.links
    results=[];seen=set()
    # In jobs.ch, recommended promo section is intentionally excluded.
    if platform=="jobs.ch" and text:
        text=text.split("Nicht verpassen! Diese Jobs sind immer noch online:")[0]
        anchors=MDLINK.findall(text) if MDLINK.findall(text) else anchors
    for title,url in anchors:
        title=" ".join(title.split())
        if title.lower() in {"company logo","jobs.ch","jobs suchen","neue jobs anzeigen","instagram","linkedin","tiktok"}:continue
        if platform=="jobs.ch":
            m=DETAIL.search(url)
            if not m:continue
            key=m.group(1).lower();canonical="https://www.jobs.ch/de/stellenangebote/detail/"+key+"/"
        elif platform=="publicjobs.ch":
            m=PUBLIC.search(url)
            if not m or re.search(r"abbestell|jobmail|jobs suchen|social",title,re.I):continue
            key=m.group(1);canonical="http://opn.publicjobs.ch/jmultn/"+key
        else:
            # Unknown employer-specific links must not be published as jobs yet.
            continue
        if canonical in seen:continue
        seen.add(canonical)
        if len(title)<6:continue
        results.append((title,canonical,key))
    records=[]
    for title,canonical,key in results:
        # Conservative company extraction from plain text only: next nonempty line after title link.
        company=location=None
        if text:
            match=re.search(r"\["+re.escape(title)+r"\]\("+re.escape(next((u for t,u in anchors if t==title),canonical))+r"\)\s*\n\s*([^\n]+)",text)
            if match:
                candidate=match.group(1).strip()
                if platform=="publicjobs.ch" and " - " in candidate: company,location=candidate.rsplit(" - ",1)
                elif platform=="jobs.ch" and ", " in candidate: company,location=candidate.rsplit(", ",1)
        lo=hi=None
        p=re.search(r"(\d{2,3})\s*[-–]\s*(\d{2,3})\s*%",title)
        q=re.search(r"(\d{2,3})\s*%",title)
        if p:lo,hi=int(p.group(1)),int(p.group(2))
        elif q:lo=hi=int(q.group(1))
        categories=[c for c,terms in CATEGORIES.items() if any(term in title.casefold() for term in terms)]
        jobid="job-"+hashlib.sha256((platform+"|"+key).encode()).hexdigest()[:24]
        records.append({
          "schema_version":"0.1.0","id":jobid,"source":platform,"source_job_id":key if platform=="jobs.ch" else None,
          "title":title,"company":company,"location":location,"remote_mode":"unknown","url":canonical,
          "published_at":None,"first_seen_at":received,"last_seen_at":received,"categories":categories,
          "description":None,"salary_chf_year_min":None,"salary_chf_year_max":None,"salary_kind":"unknown",
          "workload_pct_min":lo,"workload_pct_max":hi,"contract_type":"unknown",
          "provenance":{"source_message_id":None,"source_received_at":None,"alert_name":None},
          "processing":{"state":"needs_review","warnings":["Jobmail-Extraktion; Originalseite nicht validiert"],"extraction_confidence":None},
          "matching":{"status":"not_run","score":None}
        })
    return records

def merge(previous,incoming):
    by_id={j["id"]:j for j in previous}
    for job in incoming:
        if job["id"] in by_id:
            old=by_id[job["id"]]
            job["first_seen_at"]=old["first_seen_at"]
            for key in ("company","location"):
                if job[key] is None:job[key]=old.get(key)
            job["last_seen_at"]=max(job["last_seen_at"],old.get("last_seen_at") or old["first_seen_at"])
        by_id[job["id"]]=job
    return sorted(by_id.values(),key=lambda j:j["first_seen_at"],reverse=True)

def run():
    token=access_token()
    previous=json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else []
    if not isinstance(previous,list):raise RuntimeError("Existing JSON is not a list")
    found=[];messages=0
    for record in gmail_messages(token):
        messages+=1
        found.extend(listings(*record))
    combined=merge(previous,found)
    # Avoid overwriting a useful list if transient Gmail query yields nothing.
    if not messages and not previous:raise RuntimeError("Keine Jobmails gefunden; Initialimport abgebrochen")
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(combined,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Nachrichten gelesen: {messages}; Stellenlinks erkannt: {len(found)}; Dashboard-Datensätze: {len(combined)}")
if __name__=="__main__":
    try:run()
    except Exception as exc:
        print("Import fehlgeschlagen: "+str(exc),file=sys.stderr);raise
