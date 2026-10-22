"""Read-only preparation of explicit user labels for offline relevance training.

Absent fields are *missing observations*, not neutral/negative ratings.
Never writes to dashboard/jobs.json or alters selector/score.py.
"""

from __future__ import annotations

from typing import Any

ASPECT_CODES = frozenset({"tasks", "distance", "employer", "conditions"})
FIELD_CODES = frozenset({"unrelated", "transferable", "aligned"})
SENIORITY_CODES = frozenset({"underchallenging", "too_early", "good_chance", "overwhelming"})


def _records(payload: dict[str, Any]):
    kind = payload.get("type")
    if kind == "bewerbungs-agent-feedback":
        return ((row, "id", "score") for row in payload.get("relevance_ratings", []))
    if kind == "bewerbungs-agent-relevance-feedback":
        rated = ((row, "job_id", "user_score") for row in payload.get("ratings", []))
        partial = ((row, "job_id", "user_score") for row in payload.get("unrated_feedback", []))
        return (*rated, *partial)
    raise ValueError(f"Unsupported feedback type: {kind!r}")


def explicit_training_examples(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Keep only manually entered scores and individual criterion labels.

    A label exists if and only if it is explicitly set in the feedback JSON:
    - overall score: valid integer 1..100 (may be absent),
    - impact aspects: keys present in 'aspects' (including *explicit* zero),
    - field/seniority: non-null choices only.

    Legacy reason tags and AI suggestions must never become numeric labels.
    """
    examples = []
    for row, id_key, score_key in _records(payload):
        if not isinstance(row, dict) or not isinstance(row.get(id_key), str) or not row[id_key]:
            raise ValueError("Feedback row needs a valid job ID")
        labels: dict[str, Any] = {}
        score = row.get(score_key)
        if score is not None:
            if type(score) is not int or not 1 <= score <= 100:
                raise ValueError("Explicit overall score must be an integer from 1 to 100")
            labels["user_score"] = score
        aspects = row.get("aspects") or {}
        if not isinstance(aspects, dict):
            raise ValueError("Aspects must be a mapping")
        explicit_aspects = {}
        for aspect, value in aspects.items():
            if aspect not in ASPECT_CODES or type(value) is not int or not -100 <= value <= 100:
                raise ValueError(f"Invalid explicit aspect value: {aspect!r}")
            explicit_aspects[aspect] = value
        if explicit_aspects:
            labels["aspects"] = explicit_aspects
        field = row.get("field_relation")
        if field is not None:
            if field not in FIELD_CODES:
                raise ValueError("Unknown field relation")
            labels["field_relation"] = field
        seniority = row.get("seniority_assessment")
        if seniority is not None:
            if seniority not in SENIORITY_CODES:
                raise ValueError("Unknown seniority assessment")
            labels["seniority_assessment"] = seniority
        if labels:
            examples.append({"job_id": row[id_key], "labels": labels})
    return examples
