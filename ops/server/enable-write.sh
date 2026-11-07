#!/usr/bin/env bash
# One-time activation of write access inside the dedicated Career.Agency workspace.
# Existing SSH key, production Caddy, databases, webroot and SFTP workflow unchanged.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077
die() { echo "ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo."
[[ $# -eq 0 ]] || die "No arguments accepted."
HERE="$(cd "$(dirname "$0")" && pwd -P)"
[[ -f "$HERE/ca-ops-command" && -f "$HERE/stage_commit.sh" && -f "$HERE/feed_audit.py" ]] ||
  die "Required reviewed scripts not found."
id careeragency_runner >/dev/null 2>&1 || die "Service user not found."
[[ "$(id -u careeragency_runner)" != 0 ]] || die "Unsafe service user UID."
[[ "$(id -nG careeragency_runner)" != *sudo* ]] ||
  die "Runner unexpectedly in sudo group."
[[ -f /home/careeragency_runner/.ssh/authorized_keys ]] ||
  die "No configured restricted SSH key."
grep -Fq 'restrict,command="/usr/local/bin/careeragency-ops-command"' \
  /home/careeragency_runner/.ssh/authorized_keys ||
  die "SSH key is not restricted to approved dispatcher."
[[ -f /usr/local/bin/careeragency-ops-command ]] ||
  die "Expected SSH dispatcher not installed."
[[ "$(stat -c %U:%G /usr/local/bin/careeragency-ops-command)" == root:root ]] ||
  die "SSH dispatcher is not root-owned."

bash -n "$HERE/ca-ops-command"
bash -n "$HERE/stage_commit.sh"
python3 - "$HERE/feed_audit.py" <<'PY'
import ast, pathlib, sys
ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
PY

ROOT=/home/careeragency_runner/careeragency-workspace
[[ ! -L /home/careeragency_runner && ! -L "$ROOT" && ! -L "$ROOT/releases" ]] || die "Symlink in runner home or workspace"
install -d -o careeragency_runner -g careeragency_runner -m 0700 "$ROOT"
install -d -o careeragency_runner -g careeragency_runner -m 0700 "$ROOT/releases"
for p in "$ROOT" "$ROOT/releases"; do
  [[ ! -L "$p" ]] || die "Workspace path is a symlink: $p"
  [[ "$(stat -c '%U:%G' "$p")" == careeragency_runner:careeragency_runner ]] ||
    die "Workspace ownership mismatch: $p"
done

install -d -o root -g root -m 0755 /usr/local/lib/careeragency-ops
install -o root -g root -m 0644 "$HERE/feed_audit.py" /usr/local/lib/careeragency-ops/feed_audit.py.new
mv -f /usr/local/lib/careeragency-ops/feed_audit.py.new /usr/local/lib/careeragency-ops/feed_audit.py
install -o root -g root -m 0755 "$HERE/stage_commit.sh" \
  /usr/local/lib/careeragency-ops/stage_commit.sh.new
mv -f /usr/local/lib/careeragency-ops/stage_commit.sh.new \
  /usr/local/lib/careeragency-ops/stage_commit.sh

# Refresh the shared allowlist without dropping auth/release capabilities.
bash "$HERE/install-ops-dispatcher.sh"

echo "ssh_workspace_write=enabled"
echo "workspace=$ROOT/releases"
echo "production_files_changed=false"
echo "caddy_restart=false"
echo "secrets_changed=false"
