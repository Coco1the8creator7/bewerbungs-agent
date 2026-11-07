"""Reviewed normalizer; preserve existing stable IDs across the PoC transition."""
import hashlib
import json
from pathlib import Path

from crawler.yousty_detail import extract_detail

SOURCE = "yousty_poc"


def normalize(item: dict) -> dict:
    if item.get("source") != "yousty":
        raise ValueError("Incorrect source")
    source_id = item["source_listing_id"]
    if not isinstance(source_id, str) or not source_id.isdecimal():
        raise ValueError("Invalid Yousty listing ID")
    location = item.get("job_location")
    if not isinstance(location, dict):
        raise ValueError("Missing structured job location")
    if location.get("country") != "CH":
        raise ValueError("Expected CH address")
    city = location.get("city")
    if not isinstance(city, str) or not city.strip():
        raise ValueError("Missing city")
    company = item.get("company")
    title = item.get("title")
    if not isinstance(company, str) or not company.strip():
        raise ValueError("Missing employer")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("Missing title")
    start = item.get("job_start_date")
    year = None
    if start is not None:
        if not isinstance(start, str) or len(start) < 10:
            raise ValueError("Unrecognized start date")
        from datetime import date
        year = date.fromisoformat(start[:10]).year
    url = item.get("source_url")
    if not isinstance(url, str) or not url.startswith(
            f"https://www.yousty.ch/de-CH/lehrstellen/profile/{source_id}-"):
        raise ValueError("Source URL does not match source ID")
    stable_id = "apprenticeship-" + hashlib.sha256(
        f"{SOURCE}|{source_id}".encode()).hexdigest()[:24]
    record = {"id": stable_id, "source": SOURCE, "source_listing_id": source_id,
              "source_url": url, "title": title.strip(), "company": company.strip(),
              "location": city.strip(), "profession": None, "start_year": year,
              "application_url": None}
    hashed_fields = {k: record[k] for k in ("source_url", "title", "company",
                      "location", "profession", "start_year", "application_url")}
    record["content_hash"] = hashlib.sha256(json.dumps(
        hashed_fields, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return record

