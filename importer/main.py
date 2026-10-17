"""Run: python -m importer.main --eml-dir local/mail (offline)
or: python -m importer.main --gmail (OAuth set up on Mac).
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from pathlib import Path
from .parser import extract, source_for_sender, stable_id
from .store import connect, previously_processed, save_message, export_jobs

def parse_eml(path):
    mail = BytesParser(policy=policy.default).parsebytes(path.read_bytes())
    sender = str(mail.get("From", ""))
    subject = str(mail.get("Subject", ""))
    texts, htmls = [], []
    parts = mail.walk() if mail.is_multipart() else [mail]
    for part in parts:
        if part.get_content_disposition() == "attachment":
            continue
        if part.get_content_type() == "text/plain":
            texts.append(part.get_content())
        elif part.get_content_type() == "text/html":
            htmls.append(part.get_content())
    return {"id": str(mail.get("Message-ID") or hashlib.sha256(path.read_bytes()).hexdigest()),
            "from": sender, "subject": subject, "body": "\n".join(texts), "html": "\n".join(htmls),
            "received_at": datetime.now(timezone.utc).isoformat()}

def normalize(message, item, index):
    stamp = message.get("received_at") or datetime.now(timezone.utc).isoformat()
    warnings = []
    if not item.get("title"):
        warnings.append("Titel aus E-Mail-Link nicht sicher bestimmbar")
    if not item.get("url"):
        warnings.append("Original-URL fehlt")
    return {
        "schema_version": "0.1.0",
        "id": stable_id(item["source"], item.get("url"), message["id"], index),
        "source": item["source"], "source_job_id": None,
        "title": item.get("title") or "Unbekannter Stellentitel – bitte prüfen",
        "company": None, "location": None, "remote_mode": "unknown",
        "url": item.get("url"), "published_at": None,
        "first_seen_at": stamp, "last_seen_at": None, "categories": [],
        "description": None, "salary_chf_year_min": None, "salary_chf_year_max": None,
        "salary_kind": "unknown", "workload_pct_min": None, "workload_pct_max": None,
        "contract_type": "unknown",
        "provenance": {"source_message_id": message["id"], "source_received_at": stamp, "alert_name": message.get("subject")},
        "processing": {"state": "needs_review", "warnings": warnings + ["Generischer Parser: Arbeitgeber/Arbeitsort nicht verifiziert"], "extraction_confidence": 0.4 if item.get("title") else 0.2}
    }

def import_messages(messages, db_path="data/jobs.sqlite3", export_path="data/jobs.json"):
    db = connect(db_path)
    stats = {"seen": 0, "skipped_unchanged": 0, "offers_extracted": 0, "needs_review_messages": 0, "no_offers": 0}
    try:
        for message in messages:
            stats["seen"] += 1
            digest = hashlib.sha256(json.dumps(message, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            if previously_processed(db, message["id"], digest):
                stats["skipped_unchanged"] += 1
                continue
            extracted = extract(message["from"], message["subject"], message.get("body", ""), message.get("html"))
            jobs = [normalize(message, item, index) for index, item in enumerate(extracted)]
            outcome = "offers" if jobs else ("review" if source_for_sender(message["from"]) else "ignored")
            if outcome == "review":
                stats["needs_review_messages"] += 1
            if not jobs:
                stats["no_offers"] += 1
            save_message(db, message["id"], digest, jobs, outcome)
            stats["offers_extracted"] += len(jobs)
        stats["exported_jobs"] = export_jobs(db, export_path)
        return stats
    finally:
        db.close()

def main():
    ap = argparse.ArgumentParser(description="Local job-mail importer")
    source = ap.add_mutually_exclusive_group(required=True)
    source.add_argument("--eml-dir", type=Path)
    source.add_argument("--gmail", action="store_true")
    ap.add_argument("--db", default="data/jobs.sqlite3")
    ap.add_argument("--output", default="data/jobs.json")
    args = ap.parse_args()
    if args.gmail:
        from .gmail_api import iter_gmail
        messages = iter_gmail()
    else:
        messages = (parse_eml(p) for p in sorted(args.eml_dir.glob("*.eml")))
    print(json.dumps(import_messages(messages, args.db, args.output), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
