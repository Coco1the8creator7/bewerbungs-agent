"""Unverbindlicher, deterministischer Relevanzvorschlag. Keine Ausschlüsse, keine API."""
import json
from pathlib import Path

JOB_FILE = Path("dashboard/jobs.json")
RULES = {
    "fernwärme": 18, "wärmenetz": 18, "thermische netze": 20,
    "projektleit": 12, "energieberat": 12, "energiekonzept": 12,
    "erneuerbare energ": 10, "energie": 5, "wärmepumpe": 9,
    "energiestadt": 12, "förderprogramm": 9, "energiewende": 9,
    "dekarbonisierung": 9, "netzentwicklung": 14
}

def suggest(job):
    """A number is a ranking aid, not a confidence value or exclusion decision."""
    title = str(job.get("title") or "").casefold()
    text = (title + " " + str(job.get("description") or "").casefold())
    matches = [(word, weight) for word, weight in RULES.items() if word in text]
    score = max(1, min(100, 45 + sum(weight for _, weight in matches)))
    return {"suggested_score": score,
            "version": "heuristic-v1",
            "reason_codes": [word for word, _ in matches],
            "mode": "suggestion_only",
            "exclusion": False}

def apply(jobs):
    for job in jobs:
        job["selection"] = suggest(job)
    return jobs

def main():
    jobs = json.loads(JOB_FILE.read_text(encoding="utf-8"))
    if not isinstance(jobs, list):
        raise ValueError("Expected JSON array")
    JOB_FILE.write_text(json.dumps(apply(jobs), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
