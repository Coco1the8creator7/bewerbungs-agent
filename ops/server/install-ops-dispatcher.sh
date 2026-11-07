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
# Denial checks never invoke sudo or touch server state.
for request in 'sudo id' 'status;id' 'auth-preflight --debug' \
               'release-deploy not-a-sha' 'release-rollback ../etc/passwd' \
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
