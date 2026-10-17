"""SQLite identity/upsert and atomic JSON dashboard export."""
import json
import os
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

CREATE = """
CREATE TABLE IF NOT EXISTS messages(message_id TEXT PRIMARY KEY, digest TEXT NOT NULL, outcome TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, canonical_url TEXT, source TEXT, payload TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_url ON jobs(canonical_url) WHERE canonical_url IS NOT NULL;
CREATE TABLE IF NOT EXISTS sightings(job_id TEXT NOT NULL, message_id TEXT NOT NULL, source TEXT NOT NULL, PRIMARY KEY(job_id,message_id));
"""
def connect(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.executescript(CREATE)
    return db

def previously_processed(db, mid, digest):
    row = db.execute("SELECT digest FROM messages WHERE message_id=?", (mid,)).fetchone()
    return bool(row and row[0] == digest)

def save_message(db, message_id, digest, jobs, outcome):
    stamp = datetime.now(timezone.utc).isoformat()
    with db:
        for job in jobs:
            url = job.get("url")
            existing = db.execute("SELECT id,payload FROM jobs WHERE canonical_url=?", (url,)).fetchone() if url else None
            if existing:
                original = json.loads(existing[1])
                original["last_seen_at"] = stamp
                original["processing"]["warnings"] = list(dict.fromkeys(original["processing"].get("warnings", []) + job["processing"].get("warnings", [])))
                db.execute("UPDATE jobs SET payload=? WHERE id=?", (json.dumps(original, ensure_ascii=False), existing[0]))
                jid = existing[0]
            else:
                jid = job["id"]
                # Stable ids can collide only for duplicate occurrences; update instead of discarding.
                db.execute("INSERT INTO jobs(id,canonical_url,source,payload) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
                           (jid, url, job["source"], json.dumps(job, ensure_ascii=False)))
            db.execute("INSERT OR IGNORE INTO sightings(job_id,message_id,source) VALUES(?,?,?)", (jid, message_id, job["source"]))
        db.execute("INSERT INTO messages(message_id,digest,outcome,updated_at) VALUES(?,?,?,?) ON CONFLICT(message_id) DO UPDATE SET digest=excluded.digest,outcome=excluded.outcome,updated_at=excluded.updated_at",
                   (message_id, digest, outcome, stamp))

def export_jobs(db, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = [json.loads(r[0]) for r in db.execute("SELECT payload FROM jobs ORDER BY id")]
    tmp = path.with_name(path.name + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())
    tmp.replace(path)
    return len(rows)
