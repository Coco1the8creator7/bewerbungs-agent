#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 && $# == 0 ]] || exit 77
src=$(cd "$(dirname "$0")/../.." && pwd -P)
# Shared installer performs backup, syntax and unknown-command checks.
bash "$src/ops/server/install-ops-dispatcher.sh"
install -o root -g root -m 0750 "$src/ops/production/production-command.sh" /usr/local/sbin/careeragency-production
file=$(mktemp /etc/sudoers.d/.careeragency-production.XXXXXXXX)
trap 'rm -f "$file"' EXIT
printf '%s\n' 'careeragency_runner ALL=(root) NOPASSWD: /usr/local/sbin/careeragency-production *' > "$file"
chmod 0440 "$file"
visudo -cf "$file"
mv "$file" /etc/sudoers.d/careeragency-production
visudo -c >/dev/null
echo 'production_gateway=installed (no application/database change)'
