#!/usr/bin/env bash
# Root-owned and intentionally narrow: manage only /var/www/careeragency/current/index.html.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export GIT_TERMINAL_PROMPT=0
umask 077
[[ "$EUID" -eq 0 && "${SUDO_USER:-}" == careeragency_runner ]] || exit 77
[[ $# -eq 2 ]] || exit 64
action="$1"; argument="$2"
backups=/var/backups/careeragency-ops/releases
install -d -o root -g root -m 0700 "$backups"
exec 9>/run/lock/careeragency-release.lock
flock -n 9 || { echo "Another release is running"; exit 75; }
log() { logger -p authpriv.notice -t careeragency-release -- "$*"; printf '%s\n' "$*"; }
fail() { log "FAILED action=$action reason=$1"; exit 1; }
helper=/usr/local/lib/careeragency-ops/radar-public-root.py
[[ -f "$helper" && ! -L "$helper" && "$(stat -c %u "$helper")" == 0 ]] || fail "missing or untrusted public root helper"
base="$(timeout 10s python3 "$helper")" || fail "public root validation failed"
case "$base" in
  /var/www/careeragency/current|/var/www/careeragency/releases/*) ;;
  *) fail "unexpected live root" ;;
esac
[[ -d "$base" && ! -L "$base" && -f "$base/index.html" && ! -L "$base/index.html" ]] || fail "unexpected live directory"
if [[ "$action" == rollback ]]; then
  [[ "$argument" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]] || exit 64
  src="$backups/$argument"
  [[ -f "$src/index.html" && ! -L "$src/index.html" ]] || fail "unknown release"
  current=$(mktemp "$base/.index-rollback.XXXXXXXX")
  trap 'rm -f -- "$current"' EXIT
  cp -- "$src/index.html" "$current"
  chmod 0644 "$current"
  mv -f -- "$current" "$base/index.html"
  log "ROLLBACK release=$argument actor=${SUDO_USER} scope=index.html"
  exit
fi
[[ "$action" == check || "$action" == deploy ]] || exit 64
[[ "$argument" =~ ^[a-f0-9]{40}$ ]] || exit 64
work=$(mktemp -d /tmp/careeragency-release.XXXXXXXX)
trap 'rm -rf -- "$work"' EXIT
timeout 120s git clone -q --no-checkout https://github.com/Coco1the8creator7/bewerbungs-agent.git "$work/repo"
git -C "$work/repo" fetch -q origin main
actual=$(git -C "$work/repo" rev-parse origin/main)
[[ "$actual" == "$argument" ]] || fail "commit must equal current origin/main"
git -C "$work/repo" checkout -q --detach "$argument"
new="$work/repo/dashboard/index.html"
[[ -s "$new" && ! -L "$new" ]] || fail "missing dashboard/index.html"
log "CHECK commit=$argument actor=${SUDO_USER} current_sha256=$(sha256sum "$base/index.html" | cut -d' ' -f1) next_sha256=$(sha256sum "$new" | cut -d' ' -f1)"
[[ "$action" == deploy ]] || exit 0
release_id="$(date -u +%Y%m%dT%H%M%SZ)-${argument:0:12}"
backup="$backups/$release_id"
mkdir -m 0700 "$backup"
cp -p -- "$base/index.html" "$backup/index.html"
printf '%s\n' "$argument" > "$backup/commit.sha"
stage=$(mktemp "$base/.index-release.XXXXXXXX")
cp -- "$new" "$stage"
chmod 0644 "$stage"
mv -f -- "$stage" "$base/index.html"
log "DEPLOY release=$release_id commit=$argument actor=${SUDO_USER} scope=index.html"
echo "rollback_release_id=$release_id"
