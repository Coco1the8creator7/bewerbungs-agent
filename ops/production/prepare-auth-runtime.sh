#!/usr/bin/env bash
# Stage the reviewed auth backend without starting it, applying SQL or changing Caddy.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export GIT_TERMINAL_PROMPT=0
umask 077
[[ "$EUID" -eq 0 && $# -eq 1 && "$1" =~ ^[0-9a-f]{40}$ ]] || {
  echo 'Usage: sudo bash prepare-auth-runtime.sh CURRENT_MAIN_COMMIT_SHA' >&2; exit 64;
}
sha="$1"
for cmd in git python3 systemctl install flock; do command -v "$cmd" >/dev/null || {
  echo "Missing requirement: $cmd" >&2; exit 69;
}; done
python3 -m venv --help >/dev/null 2>&1 || {
  echo 'Missing python3-venv; install it before running this script' >&2; exit 69;
}
[[ ! -e /etc/systemd/system/careeragency-auth.service ]] || {
  echo 'Existing auth unit found; refusing to overwrite' >&2; exit 73;
}
[[ ! -e /opt/careeragency/auth-current ]] || {
  echo 'Existing auth deployment found; refusing to overwrite' >&2; exit 73;
}
exec 9>/run/lock/careeragency-auth-setup.lock
flock -n 9 || exit 75
tmp="$(mktemp -d /tmp/careeragency-auth-stage.XXXXXXXX)"
trap 'rm -rf -- "$tmp"' EXIT
git clone -q --no-checkout https://github.com/Coco1the8creator7/bewerbungs-agent.git "$tmp/repo"
git -C "$tmp/repo" fetch -q origin main
actual="$(git -C "$tmp/repo" rev-parse origin/main)"
[[ "$actual" == "$sha" ]] || {
  echo 'Requested commit is not the current reviewed main revision' >&2; exit 65;
}
git -C "$tmp/repo" checkout -q --detach "$sha"
for required in auth/security.py authservice/asgi.py authservice/requirements.txt db/migrations/001_auth_foundation.sql db/migrations/002_auth_runtime.sql ops/production/careeragency-auth.service; do
  [[ -f "$tmp/repo/$required" ]] || { echo "Missing $required" >&2; exit 66; }
done
release="/opt/careeragency/auth-releases/$sha"
[[ ! -e "$release" ]] || { echo 'Release directory already exists' >&2; exit 73; }
mkdir -p "$tmp/runtime"
cp -a "$tmp/repo/auth" "$tmp/repo/authservice" "$tmp/runtime/"
python3 -m venv "$tmp/runtime/.venv"
"$tmp/runtime/.venv/bin/python" -m pip install --disable-pip-version-check -r "$tmp/runtime/authservice/requirements.txt"
"$tmp/runtime/.venv/bin/python" -m compileall -q "$tmp/runtime/auth" "$tmp/runtime/authservice"
if ! id careeragency_auth >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin careeragency_auth
fi
install -d -o root -g root -m 0755 /opt/careeragency /opt/careeragency/auth-releases
install -d -o root -g root -m 0700 /etc/careeragency
[[ ! -e "$release" ]] || exit 73
mv "$tmp/runtime" "$release"
chown -R root:careeragency_auth "$release"
# The service account needs read/traverse rights; umask 077 initially closes these.
find "$release" -type d -exec chmod 0750 {} +
find "$release" -type f -exec chmod 0640 {} +
find "$release/.venv/bin" -maxdepth 1 -type f -exec chmod 0750 {} +
ln -s "auth-releases/$sha" /opt/careeragency/auth-current
install -o root -g root -m 0644 "$tmp/repo/ops/production/careeragency-auth.service" /etc/systemd/system/careeragency-auth.service
systemctl daemon-reload
systemctl disable careeragency-auth.service >/dev/null 2>&1 || true
logger -p authpriv.notice -t careeragency-auth "STAGED sha=$sha service_disabled=true database_unchanged=true caddy_unchanged=true"
printf 'auth_stage=prepared\nauth_service=disabled\nauth_database=untouched\nauth_caddy=untouched\nauth_commit=%s\n' "$sha"
echo 'NEXT: provision /etc/careeragency/auth.env, DB roles/migrations, route authorization and smoke tests before service start.'
