#!/usr/bin/env bash
# One-time manual install by an administrator. Does not deploy application content.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo'; exit 77; }
src="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$src/release-gateway.sh" ]] || exit 66
test -f /usr/local/bin/careeragency-ops-command
test -f /usr/local/sbin/careeragency-admin
id careeragency_runner >/dev/null
install -d -m 0700 /var/backups/careeragency-ops
ts=$(date -u +%Y%m%dT%H%M%SZ)
cp -p /usr/local/bin/careeragency-ops-command "/var/backups/careeragency-ops/forced-command-$ts"
cp -p /etc/sudoers.d/careeragency-admin "/var/backups/careeragency-ops/sudoers-$ts"
install -o root -g root -m 0750 "$src/release-gateway.sh" /usr/local/sbin/careeragency-release
printf '%s\n' 'careeragency_runner ALL=(root) NOPASSWD: /usr/local/sbin/careeragency-release *' > /etc/sudoers.d/careeragency-release
chmod 0440 /etc/sudoers.d/careeragency-release
visudo -cf /etc/sudoers.d/careeragency-release
python3 - <<'PY'
from pathlib import Path
p=Path('/usr/local/bin/careeragency-ops-command')
s=p.read_text()
needle='  *)\n    echo "Denied: SSH command is not on the Career.Agency allowlist."'
assert needle in s, 'Unknown gateway format'
if 'release-check)' in s: raise SystemExit('Ambiguous pre-existing release command')
addition='''  release-check\\ [0-9a-f]*|release-deploy\\ [0-9a-f]*|release-rollback\\ *)
    request="${SSH_ORIGINAL_COMMAND}"
    mode="${request%% *}"
    arg="${request#* }"
    case "$mode" in
      release-check) mode=check ;;
      release-deploy) mode=deploy ;;
      release-rollback) mode=rollback ;;
    esac
    exec sudo -n /usr/local/sbin/careeragency-release "$mode" "$arg"
    ;;
'''
p.write_text(s.replace(needle,addition+needle))
PY
chown root:root /usr/local/bin/careeragency-ops-command
chmod 0755 /usr/local/bin/careeragency-ops-command
bash -n /usr/local/bin/careeragency-ops-command
echo 'Installed release gateway. No production content changed.'
