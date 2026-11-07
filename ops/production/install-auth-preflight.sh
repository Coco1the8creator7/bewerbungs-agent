#!/usr/bin/env bash
# One-time operator-controlled installation; does not modify Caddy, databases or services.
set -euo pipefail
[[ "$EUID" == 0 ]] || { echo "Run with sudo"; exit 77; }
src="$(cd "$(dirname "$0")" && pwd)"
runner=/usr/local/bin/careeragency-ops-command
target=/usr/local/sbin/careeragency-auth-preflight
test -f "$runner"
test -f "$src/auth-preflight.sh"
id careeragency_runner >/dev/null
install -d -o root -g root -m 0700 /var/backups/careeragency-ops
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$runner" "/var/backups/careeragency-ops/forced-command-before-auth-preflight-$stamp"
install -o root -g root -m 0750 "$src/auth-preflight.sh" "$target"
bash -n "$target"
sudoers=/etc/sudoers.d/careeragency-auth-preflight
printf '%s\n' 'careeragency_runner ALL=(root) NOPASSWD: /usr/local/sbin/careeragency-auth-preflight' > "$sudoers"
chmod 0440 "$sudoers"
visudo -cf "$sudoers"
# Do not patch the forced command: the central version includes all approved actions.
bash "$src/../server/install-ops-dispatcher.sh"
echo "Auth preflight installed; production application and database unchanged."
