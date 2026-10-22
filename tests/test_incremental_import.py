import json
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch
from importer import github_daily as daily

class IncrementalTests(unittest.TestCase):
    def test_first_run_uses_ninety_day_lookback(self):
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(daily,"STATE",Path(temp)/"state.json"):
                day=daily.search_after()
                expected=datetime.now(timezone.utc)-timedelta(days=90)
                self.assertLessEqual(abs((datetime.strptime(day,"%Y/%m/%d").date()-expected.date()).days),1)

    def test_saved_cursor_uses_two_day_overlap(self):
        with tempfile.TemporaryDirectory() as temp:
            state=Path(temp)/"state.json"
            with patch.object(daily,"STATE",state):
                stamp=datetime(2026,10,20,5,0,tzinfo=timezone.utc)
                daily.write_state(stamp)
                self.assertEqual(daily.search_after(),"2026/10/18")
                self.assertEqual(json.loads(state.read_text())["last_success_utc"],stamp.isoformat())

    def test_parser_upgrade_forces_historical_rescan(self):
        with tempfile.TemporaryDirectory() as temp:
            state=Path(temp)/"state.json"
            with patch.object(daily,"STATE",state):
                state.write_text(json.dumps({"last_success_utc":"2026-10-20T05:00:00+00:00"}))
                expected=datetime.now(timezone.utc)-timedelta(days=90)
                actual=datetime.strptime(daily.search_after(),"%Y/%m/%d").date()
                self.assertLessEqual(abs((actual-expected.date()).days),1)

    def test_message_fetch_parallel_and_bounded(self):
        class DummyPool:
            def __init__(self,max_workers):self.max_workers=max_workers
            def __enter__(self):return self
            def __exit__(self,*args):return False
            def map(self,fn,items):return list(map(fn,items))
        def mock_api(url,token=None):
            return {"messages":[{"id":"one"},{"id":"two"}]}
        with patch.object(daily,"ThreadPoolExecutor",DummyPool),patch.object(daily,"request_json",mock_api),patch.object(daily,"fetch_message",side_effect=lambda token,item:("jobs.ch",item["id"],"","","2026-10-20T01:00:00+00:00")):
            self.assertEqual(len(list(daily.gmail_messages("token","2026/10/19"))),2)


    def test_backfill_rotates_failed_jobs_without_overwriting_existing_data(self):
        from importer.enrich import backfill_descriptions
        original = [
            {"id": "job-b", "url": "https://example.org/b", "description": None, "title": "B", "first_seen_at": "yesterday"},
            {"id": "job-a", "url": "https://example.org/a", "description": "Keep this text"},
            {"id": "job-c", "url": "https://example.org/c", "description": None, "title": "C"},
            {"id": "job-d", "url": "https://example.org/d", "description": None, "title": "D"},
        ]
        visited = []
        def fake(job):
            visited.append(job["id"])
            if job["id"] == "job-b":
                return job, "http_error"
            return dict(job, description="Details for " + job["id"]), "enriched"
        with patch("importer.enrich.enrich_one", side_effect=fake):
            rows, cursor, stats = backfill_descriptions(original, max_jobs=1)
            self.assertEqual((cursor, stats["attempted"]), ("job-b", 1))
            rows, cursor, stats = backfill_descriptions(rows, cursor, max_jobs=1)
            self.assertEqual((cursor, stats["enriched"]), ("job-c", 1))
            rows, cursor, stats = backfill_descriptions(rows, cursor, max_jobs=1)
            self.assertEqual((cursor, stats["enriched"]), ("job-d", 1))
            rows, cursor, stats = backfill_descriptions(rows, cursor, max_jobs=1)
        self.assertEqual(visited, ["job-b", "job-c", "job-d", "job-b"])
        self.assertEqual(rows[0]["id"], original[0]["id"])
        self.assertEqual(rows[0]["first_seen_at"], "yesterday")
        self.assertEqual(rows[1]["description"], "Keep this text")
        self.assertIsNone(original[2]["description"])

    def test_gmail_run_backfills_existing_jobs_and_updates_selection(self):
        from importer.github_daily import listings
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / "jobs.json"
            state = Path(temp) / "state.json"
            url = "https://www.jobs.ch/de/stellenangebote/detail/eba1bee3-5ef8-4e83-a5cc-3c51b7d8a186/"
            previous = listings("jobs.ch", "Jobmail", "[Projektleiter](" + url + ")", "",
                                "2026-10-21T05:00:00+00:00")
            old_id = previous[0]["id"]
            out.write_text(json.dumps(previous))
            original_description = "Fernwärme und thermische Netze. " * 15
            def fake_enrich(job):
                return dict(job, description=original_description,
                            description_source="jsonld_jobposting"), "enriched"
            with patch.object(daily, "OUT", out), patch.object(daily, "STATE", state), \
                    patch.object(daily, "access_token", return_value="dummy"), \
                    patch.object(daily, "gmail_messages", return_value=[]), \
                    patch("importer.enrich.enrich_one", side_effect=fake_enrich) as enriched:
                daily.run()
                new_rows = json.loads(out.read_text())
                self.assertEqual(new_rows[0]["id"], old_id)
                self.assertEqual(new_rows[0]["first_seen_at"], previous[0]["first_seen_at"])
                self.assertEqual(new_rows[0]["description"], original_description)
                self.assertIn("fernwärme", new_rows[0]["selection"]["reason_codes"])
                self.assertEqual(json.loads(state.read_text())["description_backfill_cursor"], old_id)
                daily.run()
                self.assertEqual(enriched.call_count, 1)  # description is never overwritten

if __name__=="__main__": unittest.main()
