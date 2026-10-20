import copy
import json
import unittest
from unittest.mock import patch
from importer.github_daily import listings, merge
from importer.manual_urls import import_urls, listing
from importer.pipeline import canonical_url, merge_jobs, process, validate_public

URL = "https://www.jobs.ch/de/stellenangebote/detail/eba1bee3-5ef8-4e83-a5cc-3c51b7d8a186/"
TITLE = "Projektleiter Energie 80-100%"
STAMP = "2026-10-17T01:00:00+00:00"

def page(title=TITLE, company="Fiktiv AG"):
    return '<script type="application/ld+json">' + json.dumps({
        "@type": "JobPosting", "title": title, "hiringOrganization": {"name": company},
        "jobLocation": {"address": {"addressLocality": "Zürich"}},
        "description": "<p>Planung und Projektleitung von Fernwärme und thermischen Netzen. </p>" * 10
    }) + "</script>"

def old_job():
    return listings("jobs.ch", "Jobmail", "["+TITLE+"]("+URL+")\nFiktiv AG, Zürich", "", STAMP)[0]

class ManualTests(unittest.TestCase):
    def test_new_then_known_url_is_idempotent_and_scored(self):
        fetch = lambda u: (page(), URL)
        rows, report = import_urls([], [URL], fetch)
        self.assertEqual(report[0]["status"], "added")
        self.assertEqual(rows[0]["selection"]["mode"], "suggestion_only")
        self.assertTrue(rows[0]["description"])
        validate_public(rows)
        again, report = import_urls(rows, [URL+"?utm_source=chat", URL], fetch)
        self.assertEqual(len(again), 1)
        self.assertEqual([x["status"] for x in report], ["existing", "existing"])
        self.assertEqual(again[0]["id"], old_job()["id"])

    def test_preserves_all_user_fields_and_unknown_future_feedback(self):
        old = old_job()
        protected = {
            "relevance": 91, "reasons": ["tasks"], "weights": {"tasks": 32},
            "notes": "private", "saved": True, "status": "interview",
            "feedback": {"future_version": {"anything": [1, 2]}},
            "matching": {"status": "complete", "score": 85},
            "processing": {"state": "processed", "warnings": []},
        }
        old.update(copy.deepcopy(protected))
        snapshot = copy.deepcopy(old)
        rows, report = import_urls([old], [URL], lambda u: (page(), URL))
        for key, value in protected.items():
            self.assertEqual(rows[0][key], value)
        self.assertEqual(rows[0]["first_seen_at"], STAMP)
        self.assertEqual(rows[0]["id"], old["id"])
        self.assertEqual(old, snapshot)
        # Privacy boundary refuses publication instead of stripping private state.
        with self.assertRaises(Exception):
            validate_public(rows)

    def test_gmail_reimport_keeps_enrichment_and_feedback(self):
        old = old_job()
        old.update(description="Full description", relevance=93, notes="keep")
        rows = merge([old], [old_job()])
        for key in ("id", "description", "relevance", "notes", "first_seen_at"):
            self.assertEqual(rows[0][key], old[key])

    def test_fuzzy_duplicate_held_for_review_without_mutation(self):
        old = old_job()
        incoming = listing("https://example.org/jobs/new", lambda u: (page(), u))
        rows, report = merge_jobs([old], [incoming])
        self.assertEqual(rows, [old])
        self.assertEqual(report[0]["status"], "needs_review")
        self.assertEqual(report[0]["candidate_ids"], [old["id"]])

    def test_cross_source_redirect_preserves_existing_id(self):
        old = listings("publicjobs.ch", "Jobmail",
                       "[Projektleiter Energie 80-100%](https://opn.publicjobs.ch/jmultn/abc123)\nFiktiv AG - Zürich",
                       "", STAMP)[0]
        final = "https://www.publicjobs.ch/de/jobs/12345"
        rows, report = import_urls([old], [final], lambda u: (page(), final))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], old["id"])
        self.assertEqual(report[0]["status"], "existing")

    def test_multiple_exact_matches_do_not_merge_existing_records(self):
        a = old_job()
        b = copy.deepcopy(a)
        b["id"] = "legacy-id"
        rows, report = merge_jobs([a,b], [old_job()])
        self.assertEqual(len(rows),2)
        self.assertEqual(report[0]["status"], "needs_review")

    def test_failure_never_creates_placeholder(self):
        rows, report = import_urls([], [URL], lambda u: ("no job here", u))
        self.assertEqual(rows, [])
        self.assertEqual(report[0]["status"], "fetch_or_parse_failed")
        rows, report = import_urls([old_job()], [URL], lambda u: ("no job here", u))
        self.assertEqual(rows, [old_job()])
        self.assertEqual(report[0]["status"], "existing")

    def test_ambiguous_page_is_rejected(self):
        with self.assertRaises(ValueError):
            listing(URL, lambda u: (page()+page("Different job"), u))

    def test_url_identity_and_secrets(self):
        self.assertEqual(canonical_url(URL.replace("/de/", "/fr/")+"?utm_source=x#top"), URL)
        self.assertNotEqual(canonical_url("https://example.org/Job/A"),
                            canonical_url("https://example.org/Job/a"))
        for bad in ("file:///etc/passwd", "https://user:pass@example.org/job",
                    "https://example.org/job?token=secret", "https://example.org:8080/job"):
            with self.assertRaises(ValueError):
                canonical_url(bad)

    def test_private_addresses_and_redirects(self):
        from importer.enrich import _public_address, _SafeRedirect
        with patch("importer.enrich.socket.getaddrinfo", return_value=[(2,1,6,"",("127.0.0.1",0))]):
            self.assertFalse(_public_address("https://example.org/job"))
        with self.assertRaises(ValueError):
            _SafeRedirect().redirect_request(None,None,302,"",{},"http://127.0.0.1/")

    def test_input_limit(self):
        with self.assertRaises(ValueError):
            import_urls([], [URL]*21)

    def test_shared_pipeline_enrichment_and_score(self):
        old = old_job()
        enriched = dict(old, description="Fernwärme "+"Tätigkeiten "*30, description_source="jsonld_jobposting")
        with patch("importer.enrich.enrich_jobs", return_value=([enriched],{})):
            rows, _ = process([], [old])
        self.assertEqual(rows[0]["description"], enriched["description"])
        self.assertIn("fernwärme", rows[0]["selection"]["reason_codes"])

    def test_current_public_feed_validates(self):
        from pathlib import Path
        validate_public(json.loads(Path("dashboard/jobs.json").read_text()))

if __name__ == "__main__":
    unittest.main()
