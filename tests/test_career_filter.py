"""Run the same front-end career exclusion rules in CI (Node is installed)."""
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class CareerFilterTests(unittest.TestCase):
    def test_roles_and_exceptions(self):
        result = subprocess.run(
            ["node", "tests/career-filter.cjs"], cwd=ROOT,
            text=True, capture_output=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_dashboard_loads_filter_before_inline_script(self):
        html = (ROOT / "dashboard/index.html").read_text(encoding="utf-8")
        self.assertIn('<script src="./career-filter.js"></script>', html)
        self.assertLess(html.index('src="./career-filter.js"'), html.index('function visibleJobs()'))
        self.assertIn('function unratedJobs(){return visibleJobs()', html)
        self.assertIn('function reviewedJobs(){return visibleJobs()', html)
        self.assertIn('function markedJobs(){return visibleJobs()', html)


if __name__ == "__main__":
    unittest.main()
