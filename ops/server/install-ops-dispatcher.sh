#!/usr/bin/env bash
# SINGLE installation point for the reviewed forced-command SSH dispatcher.
# Feature installers must NEVER patch or overwrite the dispatcher independently.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077

fail() { echo "dispatcher_install=denied: $*" >&2; exit 65; }
[[ "$EUID" -eq 0 && "$#" -eq 0 ]] || fail "run as root without arguments"
src_dir="$(cd -- "$(dirname "$0")" && pwd -P)"
src="$src_dir/ca-ops-command"
dest=/usr/local/bin/careeragency-ops-command
backups=/var/backups/careeragency-ops/dispatchers
[[ -f "$src" && ! -L "$src" ]] || fail "reviewed source missing"
id careeragency_runner >/dev/null 2>&1 || fail "runner missing"
[[ "$(id -u careeragency_runner)" != 0 ]] || fail "runner must not be root"
auth=/home/careeragency_runner/.ssh/authorized_keys
[[ -f "$auth" && ! -L "$auth" ]] || fail "restricted authorized_keys missing"
grep -Fq 'restrict,command="/usr/local/bin/careeragency-ops-command"' "$auth" ||
  fail "expected SSH forced-command key missing"
if [[ -e "$dest" || -L "$dest" ]]; then
  [[ -f "$dest" && ! -L "$dest" ]] || fail "installed dispatcher is not a regular file"
  [[ "$(stat -c %U:%G "$dest")" == root:root ]] || fail "installed dispatcher not root-owned"
  [[ "$(stat -c %a "$dest")" == 755 ]] || fail "unexpected dispatcher mode"
fi

bash -n "$src"
# Fail closed if the live server holds unrecognized local SSH case branches.
if [[ -f "$dest" ]]; then
  python3 - "$dest" <<'PY'
from pathlib import Path
import re
import sys

content = Path(sys.argv[1]).read_text(encoding="utf-8")
# Inspect only arms of the outer SSH dispatch case. Nested release validation
# cases are implementation details, regardless of their indentation.
installed = set()
depth = 0
outer_seen = False
try:
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        if re.fullmatch(r'case\s+.+\s+in', line):
            if depth == 0:
                if outer_seen or line != 'case "${SSH_ORIGINAL_COMMAND:-}" in':
                    raise ValueError('unrecognized outer case')
                outer_seen = True
            depth += 1
            continue
        if line == 'esac':
            depth -= 1
            if depth < 0:
                raise ValueError('unbalanced case')
            continue
        if depth == 1:
            arm = re.fullmatch(r'([^()]+?)\)(?:[ \t]+.*)?', line)
            if arm:
                installed.add(arm.group(1).strip())
    if not outer_seen or depth != 0:
        raise ValueError('unsupported case structure')
except ValueError:
    print('dispatcher_install=denied: unrecognized installed SSH case structure',
          file=sys.stderr)
    raise SystemExit(65)
known = {
    'status', 'tests', 'feed-audit', 'crawler-probe',
    r'stage\ [0-9a-f][0-9a-f][0-9a-f]*',
    'publish-lehrstellen', 'release-check', 'auth-preflight',
    r'production-plan\ *|production-lockdown\ *|production-prepare\ *|production-activate\ *',
    r'release-check\ *|release-deploy\ *|release-rollback\ *',
    r'radar-release-check\ *|radar-release-deploy\ *|radar-release-rollback\ *',
    r'release-check\ [0-9a-f]*|release-deploy\ [0-9a-f]*|release-rollback\ *',
    '*',
}
unexpected = installed - known
if not installed or '*' not in installed or unexpected:
    print('dispatcher_install=denied: unrecognized installed SSH actions: '
          + ','.join(sorted(unexpected)), file=sys.stderr)
    raise SystemExit(65)
PY
fi
# Denial checks never invoke sudo or touch server state.
for request in 'sudo id' 'status;id' 'auth-preflight --debug' \
               'release-deploy not-a-sha' 'release-rollback ../etc/passwd' 'radar-release-deploy not-a-sha' 'radar-release-rollback ../../index.html' \
               'release-check '; do
  if env SSH_ORIGINAL_COMMAND="$request" bash "$src" >/dev/null 2>&1; then
    fail "dispatcher unexpectedly accepts invalid operation"
  fi
done

if [[ -f "$dest" ]] && cmp -s "$src" "$dest"; then
  echo "dispatcher_install=unchanged"
  exit 0
fi

install -d -o root -g root -m 0700 "$backups"
previous=none
if [[ -f "$dest" ]]; then
  previous="$(mktemp "$backups/dispatcher.$(date -u +%Y%m%dT%H%M%SZ).XXXXXXXX")"
  cp -p -- "$dest" "$previous"
fi
candidate="$(mktemp /usr/local/bin/.careeragency-ops-command.XXXXXXXX)"
trap 'rm -f -- "$candidate"' EXIT
install -o root -g root -m 0755 "$src" "$candidate"
bash -n "$candidate"
mv -f -- "$candidate" "$dest"
cmp -s "$src" "$dest" || fail "installed contents differ"
[[ "$(stat -c %U:%G "$dest")" == root:root && "$(stat -c %a "$dest")" == 755 ]] ||
  fail "installed permissions differ"
echo "dispatcher_install=installed"
echo "previous_dispatcher_backup=$previous"
echo "production_application_modified=false"
