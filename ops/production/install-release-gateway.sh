#!/usr/bin/env bash
# One-time manual install by an administrator. Installs only root-owned release helpers.
# It does not deploy or modify public application content.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run with sudo'; exit 77; }

root="$(cd -- "$(dirname -- "$0")/../.." && pwd -P)"
[[ "$root" == /root/* && -d "$root/.git" && ! -L "$root" ]] || {
  echo 'Refusing to install from a non-root-owned repository checkout' >&2
  exit 77
}
for dir in "$root" "$root/ops" "$root/ops/production" "$root/ops/server"; do
  mode="$(stat -c %a "$dir" 2>/dev/null || true)"
  [[ -d "$dir" && ! -L "$dir" && "$(stat -c %u "$dir")" == 0 ]] && (( (8#$mode & 022) == 0 )) || {
    echo 'Refusing writable or symlinked source path' >&2
    exit 77
  }
done

src="$root/ops/production/release-gateway.sh"
helper_src="$root/ops/production/public_root.py"
dispatcher_src="$root/ops/server/ca-ops-command"
helper_dir=/usr/local/lib/careeragency-ops
helper_dest="$helper_dir/radar-public-root.py"
release_dest=/usr/local/sbin/careeragency-release
sudoers=/etc/sudoers.d/careeragency-release
backups=/var/backups/careeragency-ops/release-gateway-install
[[ -f "$src" && ! -L "$src" && -f "$helper_src" && ! -L "$helper_src" ]] || exit 66
[[ -f "$dispatcher_src" && ! -L "$dispatcher_src" && "$(stat -c %u "$dispatcher_src")" == 0 ]] || exit 66
for file in "$src" "$helper_src"; do
  mode="$(stat -c %a "$file" 2>/dev/null || true)"
  [[ -f "$file" && ! -L "$file" && "$(stat -c %u "$file")" == 0 ]] && (( (8#$mode & 022) == 0 )) || exit 66
done
[[ -f /usr/local/bin/careeragency-ops-command && ! -L /usr/local/bin/careeragency-ops-command ]] || exit 66
id careeragency_runner >/dev/null 2>&1
bash -n "$src"
bash -n "$root/ops/server/ca-ops-command"
python3 - "$helper_src" <<'PY'
from pathlib import Path
import sys
compile(Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec")
PY

install -d -o root -g root -m 0700 "$backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
for file in "$helper_dest" "$release_dest" "$sudoers"; do
  if [[ -e "$file" || -L "$file" ]]; then
    [[ -f "$file" && ! -L "$file" && "$(stat -c %u "$file")" == 0 ]] || exit 66
    cp -p -- "$file" "$backups/$(basename "$file").$timestamp"
  fi
done

if [[ -e "$helper_dir" || -L "$helper_dir" ]]; then
  [[ -d "$helper_dir" && ! -L "$helper_dir" && "$(stat -c %u "$helper_dir")" == 0 ]] || exit 66
fi
install -d -o root -g root -m 0755 "$helper_dir"
helper_candidate="$(mktemp "$helper_dir/.radar-public-root.XXXXXXXX")"
release_candidate="$(mktemp /usr/local/sbin/.careeragency-release.XXXXXXXX)"
sudoers_candidate="$(mktemp /etc/sudoers.d/.careeragency-release.XXXXXXXX)"
trap 'rm -f -- "$helper_candidate" "$release_candidate" "$sudoers_candidate"' EXIT

install -o root -g root -m 0644 "$helper_src" "$helper_candidate"
install -o root -g root -m 0750 "$src" "$release_candidate"
printf '%s\n' 'careeragency_runner ALL=(root) NOPASSWD: /usr/local/sbin/careeragency-release *' > "$sudoers_candidate"
chmod 0440 "$sudoers_candidate"
visudo -cf "$sudoers_candidate"

mv -f -- "$helper_candidate" "$helper_dest"
mv -f -- "$release_candidate" "$release_dest"
mv -f -- "$sudoers_candidate" "$sudoers"
visudo -cf "$sudoers"
# Never splice case statements into the live dispatcher.
bash "$root/ops/server/install-ops-dispatcher.sh"
echo 'release_gateway=installed'
echo 'production_content_modified=false'
