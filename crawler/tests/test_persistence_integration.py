"""Real PostgreSQL integration tests, explicitly opt-in.

Run ONLY as OS role careeragency_test against careeragency_test:
    CAREERAGENCY_DB_INTEGRATION=1 python -m unittest crawler.tests.test_persistence_integration -v
All modifications are rolled back after the suite; no permanent test rows.
"""
from __future__ import annotations
import copy
import os
from pathlib import Path
import unittest

from crawler.prototype import extract_fixture
from crawler.persistence import ingest

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "synthetic.html"


@unittest.skipUnless(os.environ.get("CAREERAGENCY_DB_INTEGRATION") == "1",
                     "explicit database integration opt-in required")
class DBIntegration(unittest.TestCase):
    def test_atomic_import_reimport_change_and_failure(self):
        import psycopg
        with psycopg.connect(dbname="careeragency_test", connect_timeout=5) as conn:
            with self.assertRaisesRegex(RuntimeError, "intentional rollback"):
                with conn.transaction():
                    baseline = extract_fixture("synthetic_poc", FIXTURE.read_text(encoding="utf-8"))
                    first = ingest(conn, "synthetic_poc", baseline)
                    self.assertEqual(first["inserted"], 2)
                    second = ingest(conn, "synthetic_poc", baseline)
                    self.assertEqual(second["inserted"], 0)
                    self.assertEqual(second["unchanged"], 2)
                    # Separate apprenticeships remain distinct even with same employer/title.
                    added = copy.deepcopy(baseline[0])
                    added["source_listing_id"] = "demo-seat-2"
                    added["id"] = "apprenticeship-extra-seat"
                    modified = copy.deepcopy(baseline)
                    modified[0]["title"] = "Informatiker/in EFZ - aktualisiert"
                    modified[0]["content_hash"] = "b" * 64
                    third = ingest(conn, "synthetic_poc", [*modified, added])
                    self.assertEqual(third["inserted"], 1)
                    self.assertEqual(third["changed"], 1)
                    reduced = ingest(conn, "synthetic_poc", baseline[:1])
                    self.assertEqual(reduced["missing_candidates"], 2)
                    with conn.cursor() as cur:
                        cur.execute("""SELECT count(*) FROM apprenticeship_poc.listings
                                       WHERE source_listing_id IN ('demo-002','demo-seat-2')
                                       AND availability='active'""")
                        self.assertEqual(cur.fetchone()[0], 2)
                        cur.execute("""SELECT title FROM apprenticeship_poc.listings
                                       WHERE source_listing_id='demo-001'""")
                        before = cur.fetchone()[0]
                    corrupt = copy.deepcopy(baseline)
                    corrupt[0]["title"] = "should roll back"
                    corrupt[0]["content_hash"] = "c" * 64
                    corrupt[1]["id"] = "INVALID"
                    with self.assertRaises(ValueError):
                        ingest(conn, "synthetic_poc", corrupt)
                    with conn.cursor() as cur:
                        cur.execute("""SELECT title FROM apprenticeship_poc.listings
                                       WHERE source_listing_id='demo-001'""")
                        self.assertEqual(cur.fetchone()[0], before)
                    # Deliberately undo all test data including source and run logs.
                    raise RuntimeError("intentional rollback")
