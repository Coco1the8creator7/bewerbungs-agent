#!/usr/bin/env bash
# Installs auth-only routes with backup, validation and automatic rollback.
# Never rewrites the public landing page or public feed contents.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077
[[ "$EUID" -eq 0 && $# -eq 0 ]] || {
  echo "Run with sudo from a reviewed, pinned repository checkout" >&2; exit 64;
}
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
[[ -d "$repo/.git" && -f "$repo/ops/production/caddy-auth-insert.py" ]] || exit 66
for cmd in caddy curl python3 systemctl flock sha256sum; do
  command -v "$cmd" >/dev/null || exit 69
done
[[ "$(systemctl is-active caddy)" == active ]] || exit 69
[[ "$(systemctl is-active careeragency-auth.service)" == active ]] || {
  echo "Auth service not active; refusing public routes"; exit 73;
}
exec 9>/run/lock/careeragency-auth-caddy.lock
flock -n 9 || exit 75
file=/etc/caddy/Caddyfile
[[ -f "$file" && ! -L "$file" ]] || exit 73
[[ -f /var/www/careeragency/current/index.html ]] || exit 73
[[ -e /etc/careeragency/auth.env ]] || exit 73
# Confirm local backend is running but NOT exposed before Caddy change.
probe() { curl -sk -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' "$1"; }
[[ "$(probe http://127.0.0.1:8765/account/login)" == 200 ]] || { echo "Local login unavailable"; exit 73; }
[[ "$(probe http://127.0.0.1:8765/api/auth/me)" == 401 ]] || { echo "Local auth gate failed"; exit 73; }
[[ "$(probe http://127.0.0.1:8765/admin)" == 401 ]] || { echo "Local admin gate failed"; exit 73; }
[[ "$(probe http://127.0.0.1:8765/app/)" == 401 ]] || { echo "Local app gate failed"; exit 73; }
public_before="$(probe https://careeragency.ch/)"
feed_before="$(probe https://careeragency.ch/jobs.json)"
[[ "$public_before" == 200 ]] || { echo "Public landing baseline not healthy"; exit 73; }
landing_sha_before="$(sha256sum /var/www/careeragency/current/index.html | cut -d' ' -f1)"
backup_root=/var/backups/careeragency-ops/auth/caddy
install -d -o root -g root -m 0700 "$backup_root"
backup="$backup_root/Caddyfile.$(date -u +%Y%m%dT%H%M%SZ).bak"
cp -p -- "$file" "$backup"
work="$(mktemp /etc/caddy/.Caddyfile.auth.XXXXXXXX)"
reverted=false
commit=false
rollback() {
  if [[ "$commit" != true && -f "$backup" ]]; then
    cp -p -- "$backup" "$file"
    caddy reload --config "$file" >/dev/null 2>&1 || true
    reverted=true
    echo "auth_caddy=rolled_back" >&2
  fi
  rm -f -- "$work"
}
trap rollback EXIT
python3 "$repo/ops/production/caddy-auth-insert.py" "$file" "$work"
chown --reference="$file" "$work"
chmod --reference="$file" "$work"
mv -f -- "$work" "$file"
caddy validate --config "$file" >/dev/null || {
  echo "Caddy validation failed"; exit 73;
}
caddy reload --config "$file" >/dev/null || {
  echo "Caddy reload failed"; exit 73;
}
# Fail-closed public smoke tests; any bypass restores the prior Caddyfile.
[[ "$(probe https://careeragency.ch/account/login)" == 200 ]] || exit 73
[[ "$(probe https://careeragency.ch/account.html)" == 308 ]] || exit 73
[[ "$(probe https://careeragency.ch/api/auth/me)" == 401 ]] || exit 73
[[ "$(probe https://careeragency.ch/admin)" == 401 ]] || exit 73
[[ "$(probe https://careeragency.ch/app/)" == 401 ]] || exit 73
[[ "$(probe https://careeragency.ch/)" == "$public_before" ]] || exit 73
[[ "$(probe https://careeragency.ch/jobs.json)" == "$feed_before" ]] || exit 73
[[ "$(sha256sum /var/www/careeragency/current/index.html | cut -d' ' -f1)" == "$landing_sha_before" ]] || exit 73
commit=true
logger -p authpriv.notice -t careeragency-auth "CADDY_AUTH_RELEASE routes=validated rollback_backup=$backup"
echo "auth_caddy=routed"
echo "auth_public_landing=unchanged"
echo "auth_public_feed=unchanged"
echo "auth_admin_anonymous=denied"
echo "auth_app_anonymous=denied"
