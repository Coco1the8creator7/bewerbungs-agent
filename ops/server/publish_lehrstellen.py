#!/usr/bin/env python3
"""Publish validated Yousty apprenticeship metadata on the EXISTING landing.

Restricted root-only entry point, no arguments, fixed local source and target.
It patches only the currently deployed landing logic, preserving layout and
other live changes. It does not edit Caddy, PostgreSQL, Dossiers or Radar.
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import tempfile
from urllib.request import Request, urlopen

OPS_DIR = Path("/usr/local/lib/careeragency-ops")
sys.path.insert(0, str(OPS_DIR))
from feed_audit import audit  # noqa: E402  # checked, root-owned audited metadata feed

SOURCE = Path("/srv/careeragency-landing-feed/jobs.json")
WEBROOT = Path("/var/www/careeragency/current")
PUBLIC_NAME = "lehrstellen.json"
PUBLIC_URL = "https://careeragency.ch/lehrstellen.json"
BACKUP_ROOT = Path("/var/backups/careeragency-apprenticeships")
MAX_FILE_BYTES = 1_000_000


def patch_landing(html: str) -> tuple[str, list[str]]:
    """Change only the existing job-loading and filtering logic, not the layout.

    All patterns are from the currently reviewed dashboard. Fail closed when a
    production version is incompatible, rather than overwriting a live design.
    Repeated invocation is idempotent.
    """
    changes: list[str] = []

    def change(old: str, new: str, name: str, alternatives: tuple[str, ...] = ()) -> None:
        nonlocal html
        if old == new:
            return
        if html.count(old) == 1:
            html = html.replace(old, new, 1)
            changes.append(name)
        elif old not in html and (new in html or any(x in html for x in alternatives)):
            return  # Already patched in a reviewed earlier landing variant.
        else:
            raise ValueError("Unsupported live landing revision at " + name)

    change(
        'function visibleJobs(){return jobs.filter(j=>!window.AgentCareerFilter||window.AgentCareerFilter.isVisible(j));}',
        'function visibleJobs(){return jobs;}',
        "disable_personal_adult_filter",
    )
    change(
        '<option value="priority" selected>Priorität</option><option value="date">Neueste zuerst</option>',
        '<option value="date" selected>Neueste zuerst</option>',
        "disable_personal_priority_default",
    )
    change(
        '  if(mode==="priority"&&window.AgentCareerFilter){\n'
        '   const gap=window.AgentCareerFilter.classify(b).priority-window.AgentCareerFilter.classify(a).priority;\n'
        '   if(gap)return gap;\n'
        '  }\n',
        '',
        "remove_adult_priority_sorting",
    )
    change(
        ':getScore(j)??window.AgentCareerFilter?.classify(j)?.priority??null;',
        ':getScore(j)??null;',
        "remove_adult_score_prediction",
        ("const predicted=null;",),
    )
    if 'async function archiveLegacyWorkspaceOnce(saved){' not in html:
        change(
        'async function initialize(){\n await initializeNewJobsWindow();',
        '''async function archiveLegacyWorkspaceOnce(saved){
 // Keep an independent, local-only copy before replacing old job listings.
 if(!Array.isArray(saved?.jobs)||!saved.jobs.some(j=>j.source!=="yousty.ch"))return;
 await new Promise((resolve,reject)=>{
  const request=indexedDB.open("bewerbungs-agent-local-v1",1);
  request.onerror=()=>reject(request.error||new Error("Alte Inserate konnten nicht gesichert werden."));
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction("snapshots","readwrite");
   const store=tx.objectStore("snapshots");
   const check=store.get("legacy-workspace-before-apprenticeships-v1");
   check.onsuccess=()=>{
    if(check.result===undefined)store.put(saved,"legacy-workspace-before-apprenticeships-v1");
   };
   tx.oncomplete=()=>{db.close();resolve();};
   tx.onabort=()=>{db.close();reject(tx.error||new Error("Backup fehlgeschlagen."));};
  };
 });
}
async function initialize(){
 await initializeNewJobsWindow();''',
        "archive_old_local_workspace_before_feed_import",
        )
    change(
        '  if(saved!==undefined&&saved!==null){\n   applyWorkspace(saved,"lokal gespeicherter Arbeitsstand");',
        '  if(saved!==undefined&&saved!==null){\n'
        '   await archiveLegacyWorkspaceOnce(saved);\n'
        '   applyWorkspace(saved,"lokal gespeicherter Arbeitsstand");',
        "apply_archival_before_local_workspace_replacement",
    )
    change(
        'fetch("./jobs.json",{cache:"no-store"})',
        'fetch("./lehrstellen.json",{cache:"no-store"})',
        "read_public_lehrstellen_feed",
    )
    change(
        '  const incoming=validateJobs(await response.json());\n  if(incoming.length){',
        '  const incoming=validateJobs(await response.json());\n'
        '  if(!incoming.length||incoming.some(j=>j.source!=="yousty.ch"||!j.id.startsWith("apprenticeship-")))\n'
        '   throw new Error("Lehrstellen-Feed enthält keine gültigen Lehrstellen.");\n'
        '  if(incoming.length){',
        "reject_missing_or_legacy_feed",
    )
    change(
        'loadJobs([...byId.values()],"automatischer GitHub-Import");',
        'loadJobs([...byId.values()],"Yousty-Lehrstellen-Feed");',
        "show_actual_feed_source",
    )
    change(
        'el("message").textContent=visibleJobs().length+" Inserate in der Vorauswahl ("+(jobs.length-visibleJobs().length)+" zurückgestellt · Radar > Filter-KI). Alle Originaldaten und Bewertungen bleiben erhalten.";',
        'el("message").textContent=visibleJobs().length+" Lehrstellen geladen. Bestehende Bewertungen bleiben erhalten.";',
        "remove_personal_selection_message",
        ('el("message").textContent=visibleJobs().length+" Inserate geladen. Bestehende Bewertungen und Inseratdaten bleiben erhalten.";',),
    )
    change(
        'el("message").textContent=visibleJobs().length+" Inserate vorausgewählt; "+(jobs.length-visibleJobs().length)+" im Radar zur Prüfung zurückgestellt. Bewertungen und Inseratdaten bleiben erhalten.";',
        'el("message").textContent=visibleJobs().length+" Lehrstellen geladen. Bestehende Bewertungen bleiben erhalten.";',
        "update_feed_success_message",
        ('el("message").textContent=visibleJobs().length+" Inserate geladen. Bestehende Bewertungen und Inseratdaten bleiben erhalten.";',),
    )
    change(
        '   el("message").textContent="Lokaler Arbeitsstand geladen. GitHub-Feed derzeit nicht verfügbar: "+err.message;\n   return;',
        '   jobs=[];render();\n'
        '   el("message").textContent="Lehrstellen-Feed nicht verfügbar: "+err.message+". Gespeicherte Bewertungen bleiben erhalten.";\n'
        '   return;',
        "hide_legacy_local_jobs_on_fetch_failure",
    )
    change(
        '  el("message").textContent="GitHub-Import nicht verfügbar: "+err.message+". Demo wird angezeigt.";',
        '  el("message").textContent="Lehrstellen-Feed nicht verfügbar: "+err.message;',
        "show_feed_error_instead_of_demo",
    )
    change(
        ' if(!restored)loadDemo();\n}\nfor(const [id,view]',
        ' if(!restored){jobs=[];render();}\n}\nfor(const [id,view]',
        "prevent_demo_fallback",
    )
    if 'fetch("./jobs.json",{cache:"no-store"})' in html:
        raise ValueError("Old protected feed remains in loading logic")
    if 'function visibleJobs(){return jobs.filter' in html:
        raise ValueError("Personal filter remains on public landing")
    if 'AgentCareerFilter.classify(b)' in html or 'AgentCareerFilter?.classify(j)' in html:
        raise ValueError("Adult relevance prediction remains on public landing")
    if 'fetch("./lehrstellen.json",{cache:"no-store"})' not in html:
        raise ValueError("Public feed fetch missing")
    if '<script src="./radar.js' not in html or 'id="newJobsList"' not in html:
        raise ValueError("Unexpected live page structure")
    return html, changes


def public_rows(path: Path) -> list[dict]:
    audit(path)
    items = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for job in items:
        year = next(c.split(" ", 1)[1] for c in job["categories"]
                    if c.startswith("Lehrbeginn "))
        rows.append({
            "schema_version": "0.1.0",
            "id": job["id"],
            "source": "yousty.ch",
            "source_job_id": job["source_job_id"],
            "title": job["title"],
            "company": job["company"],
            "location": job["location"],
            "url": job["url"],
            "description": "Lehrstelle mit geplantem Beginn im Jahr " + year +
                           ". Aufgaben und Anforderungen stehen im Originalinserat auf Yousty. "
                           "Die aktuelle Verfügbarkeit ist nicht unabhängig bestätigt.",
            "published_at": None,
            "first_seen_at": job.get("first_seen_at"),
            "last_seen_at": job.get("last_seen_at"),
            "categories": job["categories"],
            "processing": {"state": "needs_review",
                           "warnings": ["Verfügbarkeit nicht unabhängig bestätigt"],
                           "extraction_confidence": None},
            "matching": {"status": "not_run", "score": None},
        })
    if len(rows) < 50:
        raise ValueError("Abnormally small feed: publication stopped")
    return rows


def atomic_write(path: Path, contents: bytes, current_stat: os.stat_result | None) -> None:
    # The only file targets are hardcoded and validated by main().
    fd, temporary = tempfile.mkstemp(prefix="." + path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(contents)
            handle.flush()
            os.fsync(handle.fileno())
        if current_stat:
            os.chown(temporary, current_stat.st_uid, current_stat.st_gid)
            os.chmod(temporary, stat.S_IMODE(current_stat.st_mode))
        else:
            os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def check_public_endpoint(expected_count: int) -> None:
    request = Request(PUBLIC_URL, headers={"Accept": "application/json",
                                           "User-Agent": "CareerAgencyLandingPublisher/1.0"})
    with urlopen(request, timeout=12) as response:
        if response.status != 200:
            raise ValueError("Public feed not reachable with HTTP 200")
        data = response.read(2_000_000)
    parsed = json.loads(data)
    if not isinstance(parsed, list) or len(parsed) != expected_count:
        raise ValueError("Public feed record count differs from verified source")


def main() -> None:
    if os.geteuid() != 0 or os.environ.get("SUDO_USER") != "careeragency_runner":
        raise ValueError("Only restricted GitHub runner via sudo may publish")
    if len(sys.argv) != 1:
        raise ValueError("Publishing takes no user-controlled arguments")

    root = WEBROOT.resolve(strict=True)
    if root != WEBROOT and not root.is_relative_to(Path("/var/www/careeragency")):
        raise ValueError("Unexpected webroot symlink target")
    if not root.is_dir():
        raise ValueError("Current webroot is not a directory")

    index = root / "index.html"
    public = root / PUBLIC_NAME
    if not index.is_file() or index.is_symlink() or index.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("Invalid live index.html")
    if public.is_symlink() or (public.exists() and not public.is_file()):
        raise ValueError("Unexpected existing public feed path")

    # Validate every record BEFORE touching live files.
    rows = public_rows(SOURCE)
    existing = index.read_bytes()
    updated, changes = patch_landing(existing.decode("utf-8"))
    feed = (json.dumps(rows, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

    BACKUP_ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(BACKUP_ROOT, 0o700)
    time_tag = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = BACKUP_ROOT / ("index." + time_tag + ".html")
    if backup.exists():
        raise ValueError("Refusing to overwrite existing live backup")
    shutil.copy2(index, backup)

    # First publish metadata, then activate its consumer. Neither operation
    # modifies the old /jobs.json Caddy-protected route.
    previous = public.read_bytes() if public.exists() else None
    prev_stat = public.stat() if public.exists() else None
    atomic_write(public, feed, prev_stat)
    try:
        check_public_endpoint(len(rows))
        if changes:
            atomic_write(index, updated.encode("utf-8"), index.stat())
    except Exception:
        # Restore pre-existing public feed if verification / index update fails.
        if previous is None:
            public.unlink(missing_ok=True)
        else:
            atomic_write(public, previous, prev_stat)
        raise

    print(json.dumps({
        "landing_publish": "success",
        "public_feed_records": len(rows),
        "public_feed_http": 200,
        "landing_logic_changed": bool(changes),
        "unchanged_ui_structure": True,
        "protected_jobs_json_untouched": True,
        "production_index_backup": str(backup),
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("landing_publish=failed: " + str(exc), file=sys.stderr)
        raise SystemExit(1) from None
