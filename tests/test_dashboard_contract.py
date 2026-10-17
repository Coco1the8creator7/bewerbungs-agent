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
        scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, flags=re.DOTALL | re.IGNORECASE)
        self.assertEqual(len(scripts), 1, "Dashboard should remain a standalone HTML file")
        result = subprocess.run(["node", "--check", "-"], input=scripts[0], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_dashboard_separates_importer_and_review_status(self):
        html = (ROOT / "dashboard/index.html").read_text(encoding="utf-8")
        self.assertIn('j.processing?.state===status', html)
        self.assertIn('decisionOf(j.id)', html)
        self.assertIn('type:"bewerbungs-agent-decisions"', html)
        self.assertNotIn("localStorage", html.replace(
            "// Bewusst keine localStorage-Verwendung: auf Schul-/Arbeitgebergeräten keine privaten Spuren.", ""
        ).replace("/* Offline-Prüfworkflow: Bewerberentscheidungen bleiben strikt vom Importstatus getrennt. */", ""))

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
