"""Offline guard tests for the narrowly scoped Career.Agency Radar release."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import os
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "radar_safe_release", ROOT / "ops/production/radar-safe-release.py"
)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def mock_landing(switch: bool = True, feed: str = "lehrstellen") -> str:
    return (
        '<html><head><title>Live local changes must survive</title></head><body>'
        '<div id="unrelated-production-ui">Preserve me</div>'
        '<section id="mode-radar"><p class="radar-intro" id="radarIntro">'
        'Deine bestehenden Stellenabos liefern weiterhin aktuelle Inserate.'
        '</p>'
        + (release.MARKET_SWITCH if switch else "")
        + '<div id="radarDial"></div><section id="radarPanelProfile"></section></section>'
        + f'<script>fetch("./{feed}.json",{{cache:"no-store"}})</script>'
        + '<script src="./radar-model.js?v=legacy"></script>'
        + '<script src="./radar.js?v=legacy"></script>'
        + '<div id="live-custom-component">Do not replace</div></body></html>'
    )


def mock_reviewed() -> str:
    return (
        '<html><section id="mode-radar"><div id="radarDial"></div>'
        '<div id="radarPanelProfile"></div>'
        'Entdecke aktuelle Lehrstellen und Berufe'
        '</section>'
        '<script src="./radar-model.js?v=20261107-lehrstellen-radar-1"></script>'
        '<script src="./radar.js?v=20261107-lehrstellen-radar-1"></script></html>'
    )


class SafeRadarReleaseTests(unittest.TestCase):
    def test_surgical_patch_preserves_unrelated_server_modifications(self):
        before = mock_landing()
        after, changes = release.patch_index(before, mock_reviewed())
        self.assertNotIn('class="radar-markets"', after)
        self.assertIn('id="live-custom-component">Do not replace', after)
        self.assertIn('id="unrelated-production-ui">Preserve me', after)
        self.assertIn('fetch("./lehrstellen.json",{cache:"no-store"})', after)
        self.assertIn('id="radarDial"', after)
        self.assertEqual(len(changes), 4)
        self.assertIn(release.NEW_INTRO, after)
        for name in release.ASSETS:
            self.assertIn(f'src="./{name}?v=20261107-lehrstellen-radar-1"', after)

    def test_idempotent_on_second_pass(self):
        first, _ = release.patch_index(mock_landing(), mock_reviewed())
        second, changes = release.patch_index(first, mock_reviewed())
        self.assertEqual(first, second)
        self.assertEqual(changes, [])

    def test_fails_closed_without_existing_live_lehrstellen_feed(self):
        for feed in ("jobs", "feedback"):
            with self.subTest(feed=feed):
                with self.assertRaisesRegex(ValueError, "feed adaptation"):
                    release.patch_index(mock_landing(feed=feed), mock_reviewed())

    def test_fails_closed_for_unknown_market_switch(self):
        bad = mock_landing().replace(
            "Berufsstellen · persönlicher Test", "Unreviewed extra switch"
        )
        with self.assertRaisesRegex(ValueError, "unsupported market"):
            release.patch_index(bad, mock_reviewed())

    def test_fails_closed_for_missing_or_duplicate_script_refs(self):
        old = mock_landing()
        variants = (
            old.replace('<script src="./radar.js?v=legacy"></script>', ''),
            old.replace('<script src="./radar.js?v=legacy"></script>',
                        '<script src="./radar.js?v=legacy"></script>' * 2),
        )
        for variant in variants:
            with self.assertRaisesRegex(ValueError, "script reference"):
                release.patch_index(variant, mock_reviewed())

    def test_fails_closed_if_repo_still_shows_adult_view(self):
        with self.assertRaisesRegex(ValueError, "apprenticeship-only"):
            release.patch_index(mock_landing(), mock_reviewed() +
                                "Berufsstellen · persönlicher Test")

    def test_strict_operational_scopes_and_ids(self):
        self.assertEqual(release.FILES, ("index.html", "radar.js", "radar-model.js"))
        self.assertTrue(release.SHA.fullmatch("a" * 40))
        self.assertFalse(release.SHA.fullmatch("a" * 39))
        self.assertTrue(release.RELEASE.fullmatch("20261107T163700Z-" + "f" * 12))
        self.assertFalse(release.RELEASE.fullmatch("../etc/passwd"))
        source = (ROOT / "ops/production/radar-safe-release.py").read_text()
        self.assertNotIn("bash -c", source)
        self.assertNotIn("shell=True", source)

    def test_unknown_local_radar_asset_is_not_overwritten(self):
        def fake_git(*args, **kwargs):
            if args[1] == "log":
                return b"abcdef\n"
            if args[1] == "show":
                return b"older reviewed version"
            raise AssertionError(args)
        with patch.object(release, "run", side_effect=fake_git):
            self.assertFalse(release.is_reviewed_asset(Path("/unused"), "radar.js",
                                                       b"local customization", b"new"))
            self.assertTrue(release.is_reviewed_asset(Path("/unused"), "radar.js",
                                                      b"older reviewed version", b"new"))
            self.assertTrue(release.is_reviewed_asset(Path("/unused"), "radar.js",
                                                      b"new", b"new"))

    def test_privileged_installer_rejects_unprivileged_staging_paths(self):
        script=(ROOT/"ops/production/install-radar-release.sh").read_text()
        documentation=(ROOT/"docs/operations/radar-safe-release.md").read_text()
        self.assertIn('[[ "$root" == /root/*',script)
        self.assertIn('stat -c %u',script)
        self.assertIn('! -L "$dir"',script)
        self.assertIn('mktemp -d /root/',documentation)
        self.assertNotIn("sudo bash /home/careeragency_runner",documentation)


    def test_versioned_webroot_symlink_inside_approved_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder)/"careeragency"
            releases=base/"releases"
            target=releases/"release-01"
            target.mkdir(parents=True)
            for name in release.FILES:
                (target/name).write_text("test",encoding="utf-8")
            current=base/"current"
            current.symlink_to(target,target_is_directory=True)
            with patch.object(release,"WEBROOT_PARENT",base),patch.object(release,"LIVE",current),patch.object(release,"PUBLIC_ROOT_HELPER",ROOT/"ops/production/public_root.py"):
                release.validate_live(trusted_uids={os.geteuid()})

    def test_rejects_webroot_symlink_escape(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder)/"careeragency"
            base.mkdir()
            (base/"releases").mkdir()
            external=Path(folder)/"other-project"
            external.mkdir()
            current=base/"current"
            current.symlink_to(external,target_is_directory=True)
            with patch.object(release,"WEBROOT_PARENT",base),patch.object(release,"LIVE",current),patch.object(release,"PUBLIC_ROOT_HELPER",ROOT/"ops/production/public_root.py"):
                with self.assertRaisesRegex(ValueError,"outside direct application releases"):
                    release.validate_live(trusted_uids={os.geteuid()})

    def test_rejects_nested_symlinks_even_within_webroot(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder)/"careeragency"
            target=base/"releases"/"real"
            target.mkdir(parents=True)
            alias=base/"alias"
            alias.symlink_to(base/"releases",target_is_directory=True)
            current=base/"current"
            current.symlink_to(alias/"real",target_is_directory=True)
            with patch.object(release,"WEBROOT_PARENT",base),patch.object(release,"LIVE",current),patch.object(release,"PUBLIC_ROOT_HELPER",ROOT/"ops/production/public_root.py"):
                with self.assertRaisesRegex(ValueError,"nested symlink"):
                    release.validate_live(trusted_uids={os.geteuid()})

    def test_rejects_world_writable_webroot_parent(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder)/"careeragency"
            target=base/"releases"/"rev"
            target.mkdir(parents=True)
            for name in release.FILES:
                (target/name).write_text("test",encoding="utf-8")
            current=base/"current"
            current.symlink_to(target,target_is_directory=True)
            base.chmod(0o777)
            with patch.object(release,"WEBROOT_PARENT",base),patch.object(release,"LIVE",current),patch.object(release,"PUBLIC_ROOT_HELPER",ROOT/"ops/production/public_root.py"):
                with self.assertRaisesRegex(ValueError,"world-writable path"):
                    release.validate_live(trusted_uids={os.geteuid()})

    def test_installer_bundles_canonical_helper_with_reviewed_gateway(self):
        installer=(ROOT/"ops/production/install-radar-release.sh").read_text()
        gateway=(ROOT/"ops/production/radar-safe-release.py").read_text()
        self.assertIn("ops/production/public_root.py",installer)
        self.assertIn('install -o root -g root -m 0644 "$helper_src" "$helper_dest"',installer)
        self.assertIn("module.resolve_public_root(",gateway)
        self.assertIn('PUBLIC_ROOT_HELPER = Path("/usr/local/lib/careeragency-ops/radar-public-root.py")',gateway)

    def test_trusted_deployer_group_writers_allowed_if_only_trusted_uids(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder)/"careeragency"
            target=base/"releases"/"rev"
            target.mkdir(parents=True)
            for name in release.FILES:
                (target/name).write_text("test",encoding="utf-8")
            current=base/"current"
            current.symlink_to(target,target_is_directory=True)
            target.chmod(0o775)
            # The canonical production rule validates group membership.
            with patch.object(release,"WEBROOT_PARENT",base),patch.object(release,"LIVE",current),patch.object(release,"PUBLIC_ROOT_HELPER",ROOT/"ops/production/public_root.py"):
                release.validate_live(trusted_uids={os.geteuid()})

    def test_production_workflow_requires_owner_and_pinned_ssh(self):
        workflow = (ROOT / ".github/workflows/radar-safe-release.yml").read_text()
        self.assertIn("github.event.issue.user.id == 343900642", workflow)
        self.assertIn("StrictHostKeyChecking=yes", workflow)
        self.assertIn("careeragency-ops", workflow)
        self.assertIn("radar-release-", workflow)
        self.assertNotIn("ssh-keyscan", workflow)
        self.assertNotIn("StrictHostKeyChecking=no", workflow)
        cmd = (ROOT / "ops/server/ca-ops-command").read_text()
        self.assertIn("radar-release-check", cmd)
        self.assertIn("radar-release-deploy", cmd)
        self.assertIn("radar-release-rollback", cmd)


if __name__ == "__main__":
    unittest.main()
