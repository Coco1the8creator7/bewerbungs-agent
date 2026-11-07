#!/usr/bin/env bash
# One operator-run, review-bound path from staged code to validated auth routes.
# No secrets in GitHub Actions or command-line arguments.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export GIT_TERMINAL_PROMPT=0
umask 077
[[ "$EUID" -eq 0 && $# -eq 1 && "$1" =~ ^[a-f0-9]{40}$ && -t 0 && -t 1 ]] || {
  echo "Usage: sudo bash ops/production/go-live-auth.sh CURRENT_MAIN_SHA (interactive TTY)"; exit 64;
}
sha="$1"
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
[[ -d "$repo/.git" ]] || exit 66
[[ "$(git -C "$repo" rev-parse HEAD)" == "$sha" ]] || {
  echo "Local checkout differs from requested SHA"; exit 65;
}
[[ -z "$(git -C "$repo" status --porcelain)" ]] || {
  echo "Local checkout is modified. Refusing production release"; exit 65;
}
git -C "$repo" fetch -q origin main
[[ "$(git -C "$repo" rev-parse origin/main)" == "$sha" ]] || {
  echo "Requested SHA is not current main. Refusing production release"; exit 65;
}
[[ "$(systemctl is-active caddy)" == active ]] || exit 73
[[ "$(systemctl is-active postgresql)" == active ]] || exit 73
echo "Step 1/6: Stage exact reviewed auth runtime (no live changes)."
if [[ ! -e /opt/careeragency/auth-current && ! -L /opt/careeragency/auth-current ]]; then
  bash "$repo/ops/production/prepare-auth-runtime.sh" "$sha"
else
  [[ "$(readlink /opt/careeragency/auth-current)" == "auth-releases/$sha" ]] || {
    echo "Existing runtime from another revision; manual review required"; exit 73;
  }
  cmp -s "$repo/ops/production/careeragency-auth.service" /etc/systemd/system/careeragency-auth.service || exit 73
  echo "auth_runtime=already_staged_this_commit"
fi

echo "Step 2/6: Verify new/empty auth database or apply guarded migrations."
bash "$repo/ops/production/bootstrap-auth-db-safe.sh" "$sha"

echo "Step 3/6: Configure SMTP locally; never echo or upload credentials."
if [[ ! -e /etc/careeragency/auth.env ]]; then
  python3 "$repo/ops/production/configure-auth-secrets.py"
else
  [[ -f /etc/careeragency/auth.env && ! -L /etc/careeragency/auth.env ]] || exit 73
  echo "auth_env=already_present_not_overwritten"
fi

echo "Step 4/6: Start and verify local authentication service."
bash "$repo/ops/production/start-auth-loopback.sh"

echo "Step 5/6: Bootstrap initial administrator through local terminal."
existing="$(runuser -u careeragency_auth -- psql -XAt -d careeragency_auth \
  -c "SELECT count(*) FROM career_auth.users WHERE role='admin'")"
if [[ "$existing" == 0 ]]; then
  bash "$repo/ops/production/bootstrap-auth-admin.sh"
elif [[ "$existing" =~ ^[1-9][0-9]*$ ]]; then
  echo "auth_admin=already_exists"
else
  echo "Unexpected admin account status"; exit 73
fi

echo "Step 6/6: Publish only audited auth routes; preserve existing landing and feed."
if grep -Fq '/api/auth/' /etc/caddy/Caddyfile; then
  echo "Existing auth routes; refusing modification. Verify manually before release." >&2
  exit 73
fi
bash "$repo/ops/production/install-auth-caddy.sh"
systemctl enable careeragency-auth.service >/dev/null
echo "auth_go_live=routes_published"
echo "auth_production_smoke_checks=passed"
echo "auth_admin_totp=enroll_on_first_login"
echo "auth_dossiers_cloud_sync=not_implemented"
