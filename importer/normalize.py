"""Shared public listing normalizer for Gmail and manual URLs."""
import hashlib
import re

CATEGORIES = {
    "Fernwärme": ["fernwärme", "wärmenetz", "thermische netze", "nahwärme"],
    "Energiekonzept": ["energiekonzept", "energiesystem", "energiecontrolling"],
    "Projektleitung": ["projektleit", "projektmanager"],
    "Energieberatung": ["energieberat"],
    "Erneuerbare Energien": ["erneuerbar", "wärmepumpe", "energieingenieur"],
    "Fachbereich Energie": ["energie", "umweltingenieur"],
}

def make_job(platform, key, canonical, title, company, location, received):
    lo=hi=None
    p=re.search(r"(\d{2,3})\s*[-–]\s*(\d{2,3})\s*%",title)
    q=re.search(r"(\d{2,3})\s*%",title)
    if p: lo,hi=int(p.group(1)),int(p.group(2))
    elif q: lo=hi=int(q.group(1))
    categories=[c for c,terms in CATEGORIES.items() if any(term in title.casefold() for term in terms)]
    jobid="job-"+hashlib.sha256((platform+"|"+key).encode()).hexdigest()[:24]
    return {
        "schema_version":"0.1.0","id":jobid,"source":platform,"source_job_id":key,
        "title":title,"company":company,"location":location,"remote_mode":"unknown","url":canonical,
        "published_at":None,"first_seen_at":received,"last_seen_at":received,"categories":categories,
        "description":None,"salary_chf_year_min":None,"salary_chf_year_max":None,
        "salary_kind":"unknown","workload_pct_min":lo,"workload_pct_max":hi,
        "contract_type":"unknown","provenance":{"source_message_id":None,"source_received_at":None,"alert_name":None},
        "processing":{"state":"needs_review","warnings":["Jobmail-Link; Originalseite nicht validiert"],"extraction_confidence":None},
        "matching":{"status":"not_run","score":None}
    }
