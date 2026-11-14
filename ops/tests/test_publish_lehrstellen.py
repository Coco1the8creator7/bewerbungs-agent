"""Pre-production regression tests: patch only approved landing behavior."""
import importlib.util
import json
import re
import subprocess
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "ops/server"
sys.path.insert(0, str(SERVER))
MODULE_PATH = SERVER / "publish_lehrstellen.py"
spec = importlib.util.spec_from_file_location("ca_publish_lehrstellen", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def synthetic_record() -> dict:
    return {
        "id": "apprenticeship-" + "a" * 24,
        "source": "yousty.ch",
        "source_job_id": "12345678",
        "title": "Lehrstelle als Mediamatiker/in EFZ",
        "company": "Musterbetrieb AG",
        "location": "Zürich",
        "url": "https://www.yousty.ch/de-CH/lehrstellen/profile/12345678-muster",
        "categories": ["Lehrstelle", "EFZ", "Lehrbeginn 2027"],
        "description": "DO NOT PUBLISH third-party copyrighted full description",
        "first_seen_at": "2026-11-07T11:00:00+00:00",
        "last_seen_at": "2026-11-07T12:00:00+00:00",
    }


class LandingPublishingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.current = (ROOT / "authservice/mission-control.html").read_text(encoding="utf-8")

    def test_patches_current_existing_landing_without_layout_changes(self):
        updated, changes = module.patch_landing(self.current)
        self.assertEqual(changes, [])
        self.assertIn('fetch("./lehrstellen.json",{cache:"no-store"})', updated)
        self.assertIn('function visibleJobs(){return jobs;}', updated)
        self.assertIn('if(!incoming.length||incoming.some(j=>j.source!=="yousty.ch"', updated)
        self.assertNotIn('AgentCareerFilter.classify(b)', updated)
        self.assertNotIn('AgentCareerFilter?.classify(j)', updated)
        self.assertNotIn('if(!restored)loadDemo();', updated)
        self.assertNotIn('fetch("./jobs.json"', updated)
        # Semantics changed only in application JavaScript, existing layout preserved.
        self.assertEqual(
            self.current.split("<script>\n")[0],
            updated.split("<script>\n")[0],
        )
        for marker in ('id="newJobsList"', 'id="details"', './radar.js', './dossiers.js'):
            self.assertIn(marker, updated)

    def test_patched_browser_javascript_is_valid_syntax(self):
        updated, _ = module.patch_landing(self.current)
        inline = re.findall(r'<script(?: [^>]*)?>(.*?)</script>', updated, re.S)
        self.assertTrue(any(len(script) > 5000 for script in inline))
        with tempfile.TemporaryDirectory() as folder:
            for i, script in enumerate(inline):
                if not script.strip():
                    continue
                path = Path(folder) / f'inline_{i}.js'
                path.write_text(script, encoding='utf-8')
                subprocess.run(['node', '--check', str(path)], check=True,
                               capture_output=True, text=True)

    def test_old_browser_workspace_archived_before_feed_replaces_jobs(self):
        updated, _ = module.patch_landing(self.current)
        self.assertIn('legacy-workspace-before-apprenticeships-v1', updated)
        archive = updated.index('await archiveLegacyWorkspaceOnce(saved);')
        workspace = updated.index('applyWorkspace(saved,"lokal gespeicherter Arbeitsstand");')
        feed = updated.index('fetch("./lehrstellen.json"')
        self.assertLess(archive, workspace)
        self.assertLess(workspace, feed)

    def test_idempotent_and_never_restores_protected_feed(self):
        once, _ = module.patch_landing(self.current)
        twice, changes = module.patch_landing(once)
        self.assertEqual(once, twice)
        self.assertEqual(changes, [])

    def test_previous_poc_landing_variant_is_accepted_without_replacing_ui(self):
        updated, _ = module.patch_landing(self.current)
        poc = updated.replace(
            ':getScore(j)??null;',
            'const predicted=null;',  # Previously approved POC display behavior.
        )
        poc = poc.replace(
            'el("message").textContent=visibleJobs().length+" Lehrstellen geladen. Bestehende Bewertungen bleiben erhalten.";',
            'el("message").textContent=visibleJobs().length+" Inserate geladen. Bestehende Bewertungen und Inseratdaten bleiben erhalten.";',
        )
        changed, _ = module.patch_landing(poc)
        self.assertIn('fetch("./lehrstellen.json"', changed)
        self.assertIn('const predicted=null;', changed)
        self.assertIn('function visibleJobs(){return jobs;}', changed)

    def test_exact_live_temporary_guard_is_removed_and_feed_reaches_initializer(self):
        guard = (
            'async function initialize(){\n'
            ' await initializeNewJobsWindow();\n'
            ' // Temporär: Erwachsenen-Stellen aus produktiver Ansicht ausblenden.\n'
            ' // Gespeicherte Benutzer- und Dossierdaten bleiben unverändert.\n'
            ' loadJobs([], "Lehrstellenumstellung");\n'
            ' el("message").textContent =\n'
            '   "Der Lehrstellenpool wird vorbereitet. Aktuell sind keine Lehrstellen verfügbar.";\n'
            ' return;\n'
        )
        original = 'async function initialize(){\n await initializeNewJobsWindow();\n'
        self.assertEqual(self.current.count(original), 1)
        live_simulation = self.current.replace(original, guard)
        repaired, changed = module.patch_landing(live_simulation)
        baseline, _ = module.patch_landing(self.current)
        self.assertEqual(repaired, baseline)
        self.assertIn("remove_obsolete_temporary_early_return", changed)
        self.assertNotIn("Lehrstellenumstellung", repaired)
        self.assertIn('fetch("./lehrstellen.json"', repaired)
        repaired_again, repeated_changes = module.patch_landing(repaired)
        self.assertEqual(repaired, repaired_again)
        self.assertEqual(repeated_changes, [])

    def test_modified_unknown_temporary_guard_fails_closed(self):
        insertion = (
            'async function initialize(){\n'
            ' await initializeNewJobsWindow();\n'
            ' loadJobs([], "Lehrstellenumstellung");\n'
            ' return;\n'
        )
        original = 'async function initialize(){\n await initializeNewJobsWindow();\n'
        modified_live = self.current.replace(original, insertion)
        with self.assertRaisesRegex(ValueError, "Temporary empty-pool guard remains"):
            module.patch_landing(modified_live)

    def test_unknown_live_html_rejected_not_overwritten(self):
        with self.assertRaises(ValueError):
            module.patch_landing("<html><body>unknown UI</body></html>")

    def test_public_feed_contains_only_metadata_not_raw_description(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "jobs.json"
            # Minimum 50 real entries is tested here using unique IDs and URLs.
            records = []
            for i in range(50):
                row = synthetic_record()
                id = str(12345678 + i)
                row["id"] = "apprenticeship-" + format(i+1, "024x")
                row["source_job_id"] = id
                row["url"] = f"https://www.yousty.ch/de-CH/lehrstellen/profile/{id}-muster"
                records.append(row)
            path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
            output = module.public_rows(path)
        self.assertEqual(len(output), 50)
        self.assertEqual(output[0]["source"], "yousty.ch")
        self.assertEqual(output[0]["source_job_id"], "12345678")
        self.assertNotIn("DO NOT PUBLISH", json.dumps(output))
        self.assertIn("Originalinserat", output[0]["description"])
        self.assertEqual(output[0]["matching"]["score"], None)

    def test_legacy_adult_sources_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / "jobs.json"
            records = [synthetic_record()]
            records[0]["source"] = "jobs.ch"
            p.write_text(json.dumps(records), encoding="utf-8")
            with self.assertRaises(ValueError):
                module.public_rows(p)


if __name__ == "__main__":
    unittest.main()
