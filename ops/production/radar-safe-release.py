#!/usr/bin/env python3
"""Career.Agency scoped Radar deployment.

Protects the locally modified public landing page: surgically removes the
adult/apprentice switch, adjusts two versioned script references, and swaps
only radar.js + radar-model.js. Never deploy dashboard/index.html wholesale.
Only reviewed assets from the current main commit may be used.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

REPO = "https://github.com/Coco1the8creator7/bewerbungs-agent.git"
WEBROOT_PARENT = Path("/var/www/careeragency")
LIVE = WEBROOT_PARENT / "current"
BACKUPS = Path("/var/backups/careeragency-ops/radar-releases")
LOCK = Path("/run/lock/careeragency-release.lock")
FILES = ("index.html", "radar.js", "radar-model.js")
ASSETS = ("radar.js", "radar-model.js")
SHA = re.compile(r"[0-9a-f]{40}\Z")
RELEASE = re.compile(r"[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}\Z")
MARKET_SWITCH = """  <div class="radar-markets" role="group" aria-label="Welche Art Stellen möchtest du ansehen?">
    <button type="button" class="radar-market" data-market="career" aria-pressed="true">Berufsstellen · persönlicher Test</button>
    <button type="button" class="radar-market" data-market="apprentice" aria-pressed="false">Lehrstellen · Vorschau</button>
  </div>"""
NEW_INTRO = "Entdecke aktuelle Lehrstellen und Berufe, die zu deinen Interessen passen."


def run(*args: str, cwd: Path | None = None, timeout: int = 125) -> bytes:
    return subprocess.run(
        args, cwd=cwd, timeout=timeout, check=True, capture_output=True,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    ).stdout


def validate_live(trusted_owner: int = 0) -> None:
    """Accept a root-controlled, in-tree release symlink, never an arbitrary target.

    The production host can point /var/www/careeragency/current at a versioned
    directory. Verify that the pointer, its parent and every target directory
    are non-writable by other accounts; target must remain inside the expected
    Career.Agency webroot. This prevents writing to attacker-selected paths.
    """
    root = WEBROOT_PARENT.resolve(strict=True)
    if root != WEBROOT_PARENT or not root.is_dir():
        raise ValueError("unexpected webroot parent or symlink")
    if not LIVE.exists() or not LIVE.is_dir():
        raise ValueError("live webroot unavailable")
    if LIVE.is_symlink():
        target = LIVE.resolve(strict=True)
        if target == root or not target.is_relative_to(root):
            raise ValueError("webroot symlink target escapes approved webroot")
        # A directory name could itself be a symlink; reject every link in
        # the chain. The only permitted link is /current itself.
        parts = [root]
        rel = target.relative_to(root)
        for name in rel.parts:
            parts.append(parts[-1] / name)
        for directory in [LIVE.parent, *parts]:
            if directory.is_symlink() or not directory.is_dir():
                raise ValueError("untrusted symlink in webroot target")
            mode = directory.stat()
            if mode.st_uid != trusted_owner or stat.S_IMODE(mode.st_mode) & 0o022:
                raise ValueError("webroot path not root-owned and read-only to others")
        link = LIVE.lstat()
        if link.st_uid != trusted_owner:
            raise ValueError("webroot symlink not root-owned")
    elif LIVE.resolve(strict=True) != LIVE:
        raise ValueError("unexpected webroot path resolution")
    for name in FILES:
        path = LIVE / name
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 4_000_000:
            raise ValueError("missing or untrusted live file: " + name)


def patch_index(live_html: str, repo_html: str) -> tuple[str, list[str]]:
    """Return an exclusively Radar-scoped change; preserve all other markup."""
    if 'id="mode-radar"' not in live_html or 'id="radarDial"' not in live_html:
        raise ValueError("live Radar elements not found")
    if 'fetch("./lehrstellen.json",{cache:"no-store"})' not in live_html:
        raise ValueError("live landing lacks protected Yousty-feed adaptation; stop")
    if 'fetch("./jobs.json",{cache:"no-store"})' in live_html:
        raise ValueError("legacy public landing feed detected; stop")
    if 'id="radarDial"' not in repo_html or "Berufsstellen · persönlicher Test" in repo_html:
        raise ValueError("reviewed main not already apprenticeship-only")
    if live_html.count('id="radarIntro"') != 1:
        raise ValueError("missing or duplicate Radar introduction")

    changes: list[str] = []
    if MARKET_SWITCH in live_html:
        live_html = live_html.replace(MARKET_SWITCH, "", 1)
        changes.append("remove-market-switch")
    elif 'class="radar-markets"' in live_html or 'class="radar-market"' in live_html:
        raise ValueError("unsupported market switch markup")
    intro = re.compile(r'(<p class="radar-intro" id="radarIntro">)[^<>]*(</p>)')
    if len(intro.findall(live_html)) != 1:
        raise ValueError("unexpected Radar introduction markup")
    changed = intro.sub(lambda m: m.group(1) + NEW_INTRO + m.group(2), live_html)
    if changed != live_html:
        changes.append("update-apprenticeship-intro")
        live_html = changed

    # Copy the exact reviewed cache-version references, not the source page:
    # its server-side patches are not in the repository and MUST survive.
    for name in ASSETS:
        pattern = re.compile(r'<script src="\./' + re.escape(name) +
                             r'(?:\?v=[A-Za-z0-9_.-]+)?"\s*></script>')
        references = pattern.findall(repo_html)
        if len(references) != 1 or not re.search(r'\?v=20261107-lehrstellen-radar-[0-9]+', references[0]):
            raise ValueError("reviewed script reference missing or unversioned: " + name)
        if len(pattern.findall(live_html)) != 1:
            raise ValueError("unexpected live script reference: " + name)
        changed = pattern.sub(references[0], live_html, count=1)
        if changed != live_html:
            changes.append("version-" + name)
            live_html = changed
    if 'class="radar-markets"' in live_html or 'class="radar-market"' in live_html:
        raise ValueError("market toggles remain")
    if 'fetch("./lehrstellen.json",{cache:"no-store"})' not in live_html:
        raise ValueError("live feed adaptation lost")
    return live_html, changes


def is_reviewed_asset(repo: Path, name: str, live: bytes, new: bytes) -> bool:
    """Never overwrite a locally modified asset that is not in main history."""
    if live == new:
        return True
    revisions = run("git", "log", "--format=%H", "origin/main", "--",
                    "dashboard/" + name, cwd=repo).decode().splitlines()[:120]
    for revision in revisions:
        if live == run("git", "show", revision + ":dashboard/" + name, cwd=repo):
            return True
    return False


def atomic_replace(path: Path, data: bytes, source_stat: os.stat_result) -> None:
    fd, name = tempfile.mkstemp(prefix="." + path.name + ".radar-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chown(name, source_stat.st_uid, source_stat.st_gid)
        os.chmod(name, stat.S_IMODE(source_stat.st_mode))
        os.replace(name, path)
    finally:
        if os.path.lexists(name):
            os.unlink(name)


def payload(repo: Path) -> tuple[dict[str, bytes], list[str]]:
    validate_live()
    current = {name: (LIVE / name).read_bytes() for name in FILES}
    reviewed = {name: (repo / "dashboard" / name).read_bytes() for name in FILES}
    candidate, changes = patch_index(
        current["index.html"].decode("utf-8"),
        reviewed["index.html"].decode("utf-8"),
    )
    result = {"index.html": candidate.encode("utf-8")}
    for name in ASSETS:
        if not is_reviewed_asset(repo, name, current[name], reviewed[name]):
            raise ValueError(name + ": live changes not present in reviewed main history; stop")
        result[name] = reviewed[name]
        if current[name] != reviewed[name]:
            changes.append("update-" + name)
    return result, changes


def write_release(repo: Path, commit: str, deploy: bool) -> None:
    result, changes = payload(repo)
    print(json.dumps({
        "operation": "deploy" if deploy else "check",
        "commit": commit,
        "scope": list(FILES),
        "changes": changes,
        "live_feed_preserved": True,
        "unrelated_production_files_untouched": True,
    }, ensure_ascii=False), flush=True)
    if not deploy or not changes:
        return
    release = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + commit[:12]
    backup = BACKUPS / release
    BACKUPS.mkdir(mode=0o700, parents=True, exist_ok=True)
    backup.mkdir(mode=0o700)
    original = {name: (LIVE / name).read_bytes() for name in FILES}
    for name in FILES:
        shutil.copy2(LIVE / name, backup / name)
    (backup / "commit.sha").write_text(commit + "\n", encoding="ascii")
    try:
        for name in FILES:
            if original[name] != result[name]:
                atomic_replace(LIVE / name, result[name], (backup / name).stat())
        for name in FILES:
            if (LIVE / name).read_bytes() != result[name]:
                raise ValueError("post-deploy validation failed: " + name)
    except Exception:
        for name in FILES:
            atomic_replace(LIVE / name, original[name], (backup / name).stat())
        raise
    print("radar_release=deployed")
    print("radar_release_id=" + release)
    print("backup_dir=" + str(backup))


def rollback(release: str) -> None:
    if not RELEASE.fullmatch(release):
        raise ValueError("invalid release ID")
    validate_live()
    backup = BACKUPS / release
    if backup.is_symlink() or not backup.is_dir():
        raise ValueError("unknown or symlinked rollback release")
    for name in FILES:
        source = backup / name
        if source.is_symlink() or not source.is_file():
            raise ValueError("incomplete rollback release")
    # Backup the currently deployed variant before restoring historical files.
    saved = {name: (LIVE / name).read_bytes() for name in FILES}
    try:
        for name in FILES:
            atomic_replace(LIVE / name, (backup / name).read_bytes(), (LIVE / name).stat())
    except Exception:
        for name in FILES:
            atomic_replace(LIVE / name, saved[name], (LIVE / name).stat())
        raise
    print("radar_release=rolled_back")
    print("radar_rollback_id=" + release)


def main() -> None:
    if os.geteuid() != 0 or os.environ.get("SUDO_USER") != "careeragency_runner":
        raise ValueError("requires root through scoped sudo gateway")
    if len(sys.argv) != 3:
        raise ValueError("usage: radar-safe-release.py check|deploy SHA | rollback RELEASE_ID")
    mode, arg = sys.argv[1:]
    if mode not in {"check", "deploy", "rollback"}:
        raise ValueError("unsupported action")
    if mode == "rollback":
        if not RELEASE.fullmatch(arg):
            raise ValueError("invalid rollback ID")
    elif not SHA.fullmatch(arg):
        raise ValueError("expected immutable 40-character main commit SHA")
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if mode == "rollback":
            rollback(arg)
            return
        with tempfile.TemporaryDirectory(prefix="careeragency-radar-release-") as work:
            repo = Path(work) / "repo"
            run("git", "clone", "--quiet", "--no-checkout", REPO, str(repo))
            actual = run("git", "rev-parse", "origin/main", cwd=repo).decode().strip()
            if actual != arg:
                raise ValueError("release SHA differs from current reviewed main")
            run("git", "checkout", "--quiet", "--detach", arg, cwd=repo)
            write_release(repo, arg, mode == "deploy")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError,
            subprocess.TimeoutExpired, BlockingIOError) as err:
        print("radar_release=failed: " + str(err), file=sys.stderr)
        raise SystemExit(1) from None
