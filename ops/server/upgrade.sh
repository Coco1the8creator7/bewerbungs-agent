#!/usr/bin/env bash
# Run ONCE after the reviewed PR has been merged into main.
# Copies only reviewed diagnostics, NOT production web files.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077

die() { echo "ERROR: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "Run with sudo."
[[ $# -eq 0 ]] || die "This upgrade takes no arguments."

SOURCE_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
WRAPPER="$SOURCE_DIR/ca-ops-command"
AUDITOR="$SOURCE_DIR/feed_audit.py"

[[ -f "$WRAPPER" && -f "$AUDITOR" ]] || die "Missing reviewed server-ops files."
id careeragency_runner >/dev/null 2>&1 || die "Runner account not provisioned."
[[ "$(id -u careeragency_runner)" != "0" ]] || die "Runner UID must not be root."
[[ -f /usr/local/bin/careeragency-ops-command ]] || die "Existing forced command not found."
[[ "$(stat -c '%U:%G' /usr/local/bin/careeragency-ops-command)" == "root:root" ]] ||
  die "Existing forced command is not root-owned."
[[ "$(stat -c '%a' /usr/local/bin/careeragency-ops-command)" == "755" ]] ||
  die "Unexpected forced-command permissions."
AUTH=/home/careeragency_runner/.ssh/authorized_keys
[[ -f "$AUTH" ]] || die "Existing restricted SSH public key missing."
grep -Fq 'restrict,command="/usr/local/bin/careeragency-ops-command"' "$AUTH" ||
  die "Unexpected SSH forced-command configuration."

bash -n "$WRAPPER"
python3 - "$AUDITOR" <<'PY'
import ast, pathlib, sys
ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
print("feed_audit_syntax=valid")
PY

if [[ ! -e /usr/local/bin/careeragency-ops-command.before-upgrade ]]; then
  cp -a /usr/local/bin/careeragency-ops-command \
    /usr/local/bin/careeragency-ops-command.before-upgrade
fi
install -d -o root -g root -m 0755 /usr/local/lib/careeragency-ops
install -o root -g root -m 0644 "$AUDITOR" /usr/local/lib/careeragency-ops/feed_audit.py.new
mv -f /usr/local/lib/careeragency-ops/feed_audit.py.new /usr/local/lib/careeragency-ops/feed_audit.py
install -o root -g root -m 0755 "$WRAPPER" /usr/local/bin/careeragency-ops-command.new
mv -f /usr/local/bin/careeragency-ops-command.new /usr/local/bin/careeragency-ops-command

echo "ops_upgrade=installed"
echo "allowed_operations=status,tests,feed-audit,crawler-probe,release-check"
echo "production_modified=false"
