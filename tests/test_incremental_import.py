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

if __name__=="__main__": unittest.main()
