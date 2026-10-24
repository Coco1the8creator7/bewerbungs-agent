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
    def test_sidebar_navigation_has_six_modes_with_icons_and_bottom_account_links(self):
        html = (ROOT / "dashboard/index.html").read_text(encoding="utf-8")
        css = (ROOT / "dashboard/mode-nav.css").read_text(encoding="utf-8")
        js = (ROOT / "dashboard/mode-nav.js").read_text(encoding="utf-8")
        sidebar = re.search(r'<aside id="modeSidebar".*?</aside>', html, re.DOTALL)
        self.assertIsNotNone(sidebar)
        sidebar = sidebar.group()
        modes = re.findall(r'data-mode="([^"]+)"', sidebar)
        self.assertEqual(modes, ["startseite", "radar", "dossiers", "agency", "profil", "einstellungen"])
        self.assertEqual(sidebar.count('viewBox="0 0 24 24" aria-hidden="true" focusable="false"'), 6)
        self.assertIn('class="mode-nav-links mode-nav-secondary"', sidebar)
        self.assertLess(sidebar.index('data-mode="agency"'), sidebar.index('class="mode-nav-links mode-nav-secondary"'))
        self.assertIn('margin-top:auto', css)
        self.assertNotIn('pages.length!==modes.size', js)
        self.assertIn('pages.map(page=>page.dataset.modePage)', js)
        self.assertRegex(html, r'href="\./mode-nav\.css\?v=[^"]+"')
        self.assertRegex(html, r'src="\./mode-nav\.js\?v=[^"]+"')
        for mode in modes:
            self.assertIn(f'data-mode-page="{mode}"', html)

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
        for marker in ('id="newCount"', 'id="unratedCount"', 'id="reviewTotalCount"', 'id="declinedNewCount"'):
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
        self.assertIn('el("unratedCount").textContent=unratedJobs().length;', html)
        self.assertIn('countNewArrivals(visibleJobs(),incomingWindow.cutoff)', html)
        self.assertNotIn('id="reviewNewCount"', html)
        self.assertIn('manualOverrides', html)
        self.assertIn('type:"bewerbungs-agent-decisions"', html)
        self.assertNotIn("localStorage", html)

    def test_job_rating_controls_only_appear_inside_details_dialog(self):
        html = (ROOT / "dashboard/index.html").read_text(encoding="utf-8")
        cards = re.search(r"function renderNewJobs\(\)\{(.*?)\n\}\nfunction render\(", html, re.DOTALL)
        details = re.search(r"function openDetails\(id\)\{(.*?)\n\}\nfunction startNewJob\(", html, re.DOTALL)
        self.assertIsNotNone(cards, "Job-card rendering function not found")
        self.assertIsNotNone(details, "Details dialog function not found")
        self.assertNotIn("ratingPanel(", cards.group(1),
                         "The landing-page job cards must not contain rating controls")
        self.assertIn("card.append(tags);", cards.group(1))
        self.assertIn("openDetails(j.id)", cards.group(1),
                      "Clicking a job card must still open its details dialog")
        self.assertIn('el("detailReviewHost").replaceChildren(ratingPanel(j))', details.group(1),
                      "The existing rating editor must remain in the details dialog")

    def test_earth_palette_covers_dashboard_and_agency(self):
        html = (ROOT / "dashboard/index.html").read_text(encoding="utf-8")
        agency = (ROOT / "dashboard/agency-world.css").read_text(encoding="utf-8")
        light = (ROOT / "dashboard/light-earth.css").read_text(encoding="utf-8")
        self.assertIn("--world-design-background:#f1e7d8", html)
        self.assertIn("body{background:var(--earth-bg);color:var(--earth-page-text)}", html)
        self.assertIn('href="./agency-world.css"', html)
        self.assertIn('href="./light-earth.css"', html)
        self.assertLess(html.index('href="./agency-world.css"'), html.index('href="./light-earth.css"'))
        self.assertIn("color-scheme: light", light)
        self.assertIn("--earth-surface: #f8f1e7", light)
        self.assertIn("--earth-raised: #fdf7ee", light)
        self.assertIn("--earth-border: #d8c7b1", light)
        self.assertIn("background: var(--earth-surface)", light)
        self.assertIn(".stat, .panel, .card, .mission-card", light)
        self.assertIn(".feedback-spectrum", light)
        self.assertIn(".floating-save", light)
        self.assertIn(".agency-world {", light)
        self.assertIn(".agency-ground", light)
        self.assertIn(".agency-building, .agency-tower", light)
        self.assertIn(".agency-world{", agency)  # Pixel-art layout retained.
        self.assertNotIn("#101727", light, "Legacy dark-blue page background must not return")
        self.assertNotIn("#201b17", light, "Legacy espresso surfaces must not return")

        def luminance(hex_color):
            channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
            r, g, b = [(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in channels]
            return 0.2126 * r + 0.7152 * g + 0.0722 * b

        def contrast(foreground, background):
            a, b = sorted([luminance(foreground), luminance(background)])
            return (b + 0.05) / (a + 0.05)

        # Surfaces are intentionally close in lightness, not dark islands on beige.
        self.assertLess(contrast("#f1e7d8", "#f8f1e7"), 1.2)
        self.assertLess(contrast("#f1e7d8", "#fdf7ee"), 1.3)
        # Text, buttons, statuses and hints retain WCAG AA minimum contrast.
        for foreground, background in (
            ("#49392b", "#f8f1e7"),  # Card text
            ("#6b5845", "#f8f1e7"),  # Small metadata
            ("#49392b", "#fdf7ee"),  # Modal text
            ("#fff9f1", "#795a40"),  # Save button text
            ("#4e3b2c", "#e8dbc9"),  # Secondary button label
            ("#36553c", "#e0e9d8"),  # Positive status
            ("#7c4535", "#f1e0d5"),  # Negative status
            ("#6b5845", "#f1e7d8"),  # Section text on beige
        ):
            self.assertGreaterEqual(contrast(foreground, background), 4.5,
                                    f"Insufficient contrast: {foreground} on {background}")

    def test_floating_rating_save_reuses_existing_github_action(self):
        html = (ROOT / "dashboard/index.html").read_text(encoding="utf-8")
        self.assertIn('id="floatingSaveGithubFeedback"', html)
        self.assertIn('class="floating-save"', html)
        self.assertIn('position:fixed;', html)
        self.assertIn('safe-area-inset-bottom', html)
        self.assertIn('el("floatingSaveGithubFeedback").addEventListener("click",()=>el("saveGithubFeedback").click());', html)
        self.assertEqual(html.count('el("saveGithubFeedback").addEventListener("click",async()=>{'), 1)
        self.assertIn("button.disabled=true;floating.disabled=true;", html)
        self.assertIn("button.disabled=false;floating.disabled=false;", html)
        self.assertIn('document.querySelector("dialog[open]")', html)
        self.assertIn('addEventListener("scroll",updateFloatingSaveVisibility,{passive:true})', html)
        self.assertIn('showFloatingSaveFeedback("Bewertungen gespeichert ✓")', html)

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
