#!/usr/bin/env bash
# Start the backend on loopback only after local DB and secret checks.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
[[ "$EUID" -eq 0 && $# -eq 0 ]] || exit 64
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
unit=/etc/systemd/system/careeragency-auth.service
envfile=/etc/careeragency/auth.env
[[ -f "$unit" && ! -L "$unit" ]] || { echo "No reviewed systemd unit"; exit 73; }
cmp -s "$unit" "$repo/ops/production/careeragency-auth.service" || {
  echo "Existing unit is different. Review required."; exit 73;
}
[[ -f "$envfile" && ! -L "$envfile" ]] || { echo "Missing protected credentials"; exit 73; }
[[ "$(stat -c %U:%G "$envfile")" == root:root ]] || { echo "Unsafe secret ownership"; exit 73; }
mode="$(stat -c %a "$envfile")"
[[ "$mode" == 600 ]] || { echo "Unsafe secret mode ($mode)"; exit 73; }
[[ -d /opt/careeragency/auth-current/authservice ]] || exit 73
[[ -x /opt/careeragency/auth-current/.venv/bin/uvicorn ]] || exit 73
[[ "$(systemctl is-active postgresql || true)" == active ]] || exit 73
runuser -u careeragency_auth -- psql -XAt -d careeragency_auth -c   "SELECT CASE WHEN to_regclass('career_auth.rate_counters') IS NOT NULL THEN 'ready' ELSE 'missing' END" |
  grep -qx ready || { echo "Auth database not ready for runtime"; exit 73; }
if [[ "$(systemctl is-active careeragency-auth.service || true)" != active ]]; then
  systemctl start careeragency-auth.service
fi
[[ "$(systemctl is-active careeragency-auth.service)" == active ]] || exit 73
probe() { curl -sS --connect-timeout 3 --max-time 10 -o /dev/null -w '%{http_code}' "$1"; }
for i in 1 2 3 4 5; do
  if [[ "$(probe http://127.0.0.1:8765/account/login || true)" == 200 ]]; then break; fi
  sleep 1
done
[[ "$(probe http://127.0.0.1:8765/account/login)" == 200 ]] || {
  systemctl stop careeragency-auth.service
  echo "Auth backend failed local health check; stopped"; exit 73;
}
[[ "$(probe http://127.0.0.1:8765/api/auth/me)" == 401 ]] || {
  systemctl stop careeragency-auth.service; echo "Auth gate failed; stopped"; exit 73;
}
[[ "$(probe http://127.0.0.1:8765/admin)" == 401 ]] || {
  systemctl stop careeragency-auth.service; echo "Admin gate failed; stopped"; exit 73;
}
[[ "$(probe http://127.0.0.1:8765/app/)" == 401 ]] || {
  systemctl stop careeragency-auth.service; echo "App gate failed; stopped"; exit 73;
}
logger -p authpriv.notice -t careeragency-auth "LOCAL_START_OK public_routing=unchanged"
echo "auth_backend=loopback_ready"
echo "auth_public_routes=unchanged"
echo "auth_admin_unauthenticated=denied"
echo "auth_app_unauthenticated=denied"
