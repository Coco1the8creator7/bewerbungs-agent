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
cp -p /etc/sudoers.d/careeragency-admin "/var/backups/careeragency-ops/sudoers-$ts"
install -o root -g root -m 0750 "$src/release-gateway.sh" /usr/local/sbin/careeragency-release
printf '%s\n' 'careeragency_runner ALL=(root) NOPASSWD: /usr/local/sbin/careeragency-release *' > /etc/sudoers.d/careeragency-release
chmod 0440 /etc/sudoers.d/careeragency-release
visudo -cf /etc/sudoers.d/careeragency-release
# Never splice case statements into the live dispatcher.
bash "$src/../server/install-ops-dispatcher.sh"
echo 'Installed release gateway. No production content changed.'
