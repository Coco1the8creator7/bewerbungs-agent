#!/usr/bin/env bash
# One-time administrator bootstrap for the narrow Radar-only release gateway.
# NEVER deploys the application, changes Caddy or touches user data.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077
[[ $EUID -eq 0 && $# -eq 0 ]] || { echo 'Run as root with no arguments'; exit 77; }
root="$(cd -- "$(dirname -- "$0")/../.." && pwd -P)"
# Never execute root-owned installation logic from the unprivileged
# careeragency_runner staging area. Only a root-owned checkout below /root
# is acceptable; verify its path components and exact immutable Git identity.
[[ "$root" == /root/* && -d "$root/.git" && ! -L "$root" ]] || {
  echo 'Refusing to install from a non-root-owned repository checkout'; exit 77;
}
for dir in "$root" "$root/ops" "$root/ops/production"; do
  [[ -d "$dir" && ! -L "$dir" && "$(stat -c %u "$dir")" == 0 ]] || {
    echo 'Refusing writable or symlinked source path'; exit 77;
  }
done
src="$root/ops/production/radar-safe-release.py"
dest=/usr/local/sbin/careeragency-radar-release
sudoers=/etc/sudoers.d/careeragency-radar-release
backups=/var/backups/careeragency-ops/radar-install
[[ -f "$src" && ! -L "$src" ]] || exit 66
[[ -f /usr/local/bin/careeragency-ops-command && ! -L /usr/local/bin/careeragency-ops-command ]] || exit 66
id careeragency_runner >/dev/null 2>&1
python3 - "$src" <<'PY'
from pathlib import Path
import sys
compile(Path(sys.argv[1]).read_text(encoding='utf-8'),sys.argv[1],'exec')
PY
install -d -o root -g root -m 0700 "$backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -f "$dest" ]]; then
  cp -p "$dest" "$backups/radar-release-$timestamp.py"
fi
if [[ -f "$sudoers" ]]; then
  cp -p "$sudoers" "$backups/sudoers-$timestamp"
fi
temporary="$(mktemp /etc/sudoers.d/.careeragency-radar-release.XXXXXXXX)"
trap 'rm -f -- "$temporary"' EXIT
printf '%s\n' 'careeragency_runner ALL=(root) NOPASSWD: /usr/local/sbin/careeragency-radar-release *' > "$temporary"
chmod 0440 "$temporary"
visudo -cf "$temporary"
install -o root -g root -m 0750 "$src" "$dest"
mv -f "$temporary" "$sudoers"
visudo -cf "$sudoers"
# Preserve unrelated installed actions; centralized dispatcher installer
# checks for unknown existing commands and writes an atomic backup.
bash "$root/ops/server/install-ops-dispatcher.sh"
echo "radar_gateway=installed"
echo "production_content_modified=false"
