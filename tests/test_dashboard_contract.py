"""Offline contract tests for dashboard and fictional sample data.

No Gmail credentials, network access, or production data required.
"""
import json
import re
import subprocess
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]


class DashboardContractTests(unittest.TestCase):
    def test_dashboard_has_valid_javascript(self):
        html = (ROOT / "dashboard/index.html").read_text(encoding="utf-8")
        scripts = re.findall(r"<script>(.*?)</script>", html, flags=re.DOTALL | re.IGNORECASE)
        self.assertEqual(len(scripts), 1, "Expected one inline dashboard script")
        self.assertIn('<script src="./storage.js"></script>', html)
        stored = subprocess.run(["node", "--check", "dashboard/storage.js"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(stored.returncode, 0, stored.stderr)
        result = subprocess.run(["node", "--check", "-"], input=scripts[0], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_dashboard_has_three_business_sections_and_footer_tools(self):
        html = (ROOT / "dashboard/index.html").read_text(encoding="utf-8")
        overview = html.index('id="overviewTitle"')
        pipeline = html.index('id="pipelineTitle"')
        new_jobs = html.index('id="newJobsTitle"')
        tools = html.index('class="bottom"')
        self.assertLess(overview, pipeline)
        self.assertLess(pipeline, new_jobs)
        self.assertLess(new_jobs, tools)
        for marker in ('id="newCount"', 'id="reviewNewCount"', 'id="reviewTotalCount"', 'id="declinedNewCount"'):
            self.assertIn(marker, html)
        self.assertIn('id="exportDecisions"', html)
        self.assertIn('class="tools"', html)
        self.assertIn('stage_changed_at', html)
        self.assertIn('id="persistEnabled"', html)
        self.assertIn('id="exportWorkspace"', html)
        self.assertIn('id="importWorkspace"', html)
        self.assertIn('id="exportJobs"', html)
        self.assertIn('id="editCategories"', html)
        self.assertIn('id="addJob"', html)
        self.assertIn('manualOverrides', html)
        self.assertIn('type:"bewerbungs-agent-decisions"', html)
        self.assertNotIn("localStorage", html)

    def test_dashboard_stage_and_score_logic(self):
        result = subprocess.run(["node", "tests/test_dashboard_logic.cjs"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_indexeddb_adapter_save_restore_and_clear(self):
        result = subprocess.run(["node", "tests/test_storage_adapter.cjs"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_matching_schema_validates_score_state(self):
        schema = json.loads((ROOT / "schemas/job.schema.json").read_text(encoding="utf-8"))
        job = json.loads((ROOT / "examples/jobs.example.json").read_text(encoding="utf-8"))[0]
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        job["matching"] = {"status": "complete", "score": 82, "rationale": "Anonymisiertes Beispiel"}
        self.assertTrue(validator.is_valid(job), "Completed score should be valid")
        job["matching"] = {"status": "pending", "score": 90}
        self.assertFalse(validator.is_valid(job), "Pending score cannot be presented as complete")
        job["matching"] = {"status": "complete", "score": 101}
        self.assertFalse(validator.is_valid(job), "Score greater than 100 invalid")

    def test_fixture_matches_schema(self):
        schema = json.loads((ROOT / "schemas/job.schema.json").read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        fixtures = json.loads((ROOT / "examples/jobs.example.json").read_text(encoding="utf-8"))
        self.assertIsInstance(fixtures, list)
        self.assertTrue(fixtures)
        self.assertEqual(len({job["id"] for job in fixtures}), len(fixtures))
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        for i, job in enumerate(fixtures):
            errors = sorted(validator.iter_errors(job), key=lambda error: list(map(str, error.path)))
            self.assertFalse(errors, f"Fixture {i}: " + "; ".join(error.message for error in errors))


if __name__ == "__main__":
    unittest.main()
