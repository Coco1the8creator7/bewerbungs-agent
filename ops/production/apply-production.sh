#!/usr/bin/env bash
# One bundled, owner-operated rollout. No arbitrary remote shell or SQL arguments.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077
[[ $EUID == 0 && $# == 1 ]] || { echo 'Usage: sudo bash ops/production/apply-production.sh plan|lockdown|prepare|activate'; exit 64; }
mode=$1
case "$mode" in plan|lockdown|prepare|activate) ;; *) exit 64 ;; esac
src=$(cd "$(dirname "$0")/../.." && pwd -P)
sha=$(git -C "$src" rev-parse HEAD)
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || exit 65
exec 9>/run/lock/careeragency-production.lock
flock -n 9 || exit 75
live=/var/www/careeragency/current
backup=/var/backups/careeragency-ops/production/$(date -u +%Y%m%dT%H%M%SZ)-${sha:0:12}
log() { logger -t careeragency-release -- "$*"; printf '%s\n' "$*"; }
if [[ "$mode" == plan ]]; then
  printf 'commit=%s\n' "$sha"
  systemctl is-active careeragency-auth.service || true
  printf 'live_path_kind=%s\n' "$([[ -L "$live" ]] && echo symlink || echo directory_or_missing)"
  printf 'live_resolved_path=%s\n' "$(readlink -e "$live" || true)"
  stat -Lc 'live_target_owner=%U:%G live_target_mode=%a' "$live" 2>/dev/null || true
  for f in /etc/careeragency/auth.env /etc/caddy/Caddyfile /opt/careeragency/auth-current; do
    if [[ -e "$f" ]]; then printf 'present=%s\n' "$f"; else printf 'missing=%s\n' "$f"; fi
  done
  exit
fi
# Never run a checkout different from reviewed, current main; never install dirty code.
git -C "$src" fetch -q origin main
[[ "$(git -C "$src" rev-parse origin/main)" == "$sha" ]] || { echo 'Checkout must equal current main'; exit 65; }
[[ -z "$(git -C "$src" status --porcelain --untracked-files=no)" ]] || { echo 'Tracked local changes found'; exit 65; }
# Pin the canonical release path; a normal current -> releases/<id> symlink
# is supported, while external/untrusted/symlinked assets remain rejected.
live=$(python3 "$src/ops/production/public_root.py") || exit 65
install -d -m 0700 "$backup"
cp -p /etc/caddy/Caddyfile "$backup/Caddyfile"
if [[ "$mode" == lockdown ]]; then
  # Remove the actual live payload reversibly. Proxy matching alone is insufficient.
  for name in feedback.json; do
    [[ ! -L "$live/$name" ]] || exit 65
    if [[ -f "$live/$name" ]]; then mv "$live/$name" "$backup/$name"; fi
  done
  install -m 0644 "$src/dashboard/github-sync.js" "$live/github-sync.js"
  code=$(curl -sS -o /dev/null -w '%{http_code}' https://careeragency.ch/feedback.json)
  [[ "$code" == 404 || "$code" == 401 || "$code" == 403 ]] || { log 'lockdown=failed (proxy route needs review)'; exit 70; }
  log "lockdown=complete backup=$backup"
  exit
fi
if [[ "$mode" == prepare ]]; then
  systemctl is-active --quiet careeragency-auth.service && { echo 'Active runtime requires a scheduled update; refusing first-install flow'; exit 73; }
  expected=$(cat "$src/ops/production/approved-public-index.sha256")
  actual=$(sha256sum "$live/index.html" | cut -d' ' -f1)
  next=$(sha256sum "$src/dashboard/index.html" | cut -d' ' -f1)
  [[ "$actual" == "$expected" || "$actual" == "$next" ]] || { echo 'Live UI changed; compare before deploying'; exit 65; }
  for user in careeragency_auth careeragency_crawler; do
    id "$user" >/dev/null 2>&1 || useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin "$user"
  done
  install -d -m 0755 /opt/careeragency /opt/careeragency/auth-releases
  release=/opt/careeragency/auth-releases/$sha
  [[ ! -e "$release" ]] || { echo 'Release exists; inspect before retry'; exit 73; }
  install -d -m 0755 "$release"
  cp -a "$src/auth" "$src/authservice" "$src/crawler" "$src/dashboard" "$release/"
  # Final path from the start: venv scripts otherwise retain deleted /tmp shebangs.
  python3 -m venv "$release/.venv"
  "$release/.venv/bin/python" -m pip install --disable-pip-version-check -r "$release/authservice/requirements.txt"
  "$release/.venv/bin/python" -m compileall -q "$release/auth" "$release/authservice" "$release/crawler"
  chown -R root:root "$release"
  find "$release" -type d -exec chmod 0755 {} +
  find "$release" -type f -exec chmod 0644 {} +
  find "$release/.venv/bin" -maxdepth 1 -type f -exec chmod 0755 {} +
  for name in feedback.json jobs.json; do
    # Keep source snapshots only in root-readable backup, outside all served paths.
    if [[ -f "$release/dashboard/$name" ]]; then mv "$release/dashboard/$name" "$backup/source-$name"; fi
  done
  if [[ -e /opt/careeragency/auth-current || -L /opt/careeragency/auth-current ]]; then
    readlink /opt/careeragency/auth-current > "$backup/previous-auth-link"
  fi
  ln -s "$release" /opt/careeragency/.auth-next
  mv -Tf /opt/careeragency/.auth-next /opt/careeragency/auth-current
  install -d -m 0700 /etc/careeragency
  install -d -o careeragency_crawler -g careeragency_crawler -m 0755 /srv/careeragency-public
  [[ -s "$live/lehrstellen.json" ]] || { echo 'Existing validated feed missing'; exit 66; }
  install -o careeragency_crawler -g careeragency_crawler -m 0644 "$live/lehrstellen.json" /srv/careeragency-public/lehrstellen.json
  # Peer-authenticated runtime: no database password exposed to browser or GitHub.
  runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d postgres <<'SQL'
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='careeragency_auth') THEN CREATE ROLE careeragency_auth LOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='careeragency_crawler') THEN CREATE ROLE careeragency_crawler LOGIN; END IF;
END $$;
ALTER ROLE careeragency_auth NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE careeragency_crawler NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
SQL
  if [[ -z "$(runuser -u postgres -- psql -XAt -d postgres -c "SELECT 1 FROM pg_database WHERE datname='careeragency_auth'")" ]]; then
    runuser -u postgres -- createdb --owner=postgres careeragency_auth
  fi
  runuser -u postgres -- pg_dump -Fc careeragency_auth > "$backup/auth-before.dump"
  test -s "$backup/auth-before.dump"
  # Verify that the backup can actually be restored before applying migrations.
  restore_db=careeragency_restore_${sha:0:12}
  [[ -z "$(runuser -u postgres -- psql -XAt -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$restore_db'")" ]] || exit 73
  runuser -u postgres -- createdb "$restore_db"
  runuser -u postgres -- pg_restore --exit-on-error --no-owner -d "$restore_db" < "$backup/auth-before.dump"
  # Keep the restore database for review; never drop an unknown existing database.
  bash "$src/ops/production/migrate-production.sh" "$src" "$restore_db"
  bash "$src/ops/production/migrate-production.sh" "$src"
  (cd "$release" && runuser -u postgres -- "$release/.venv/bin/python" -m crawler.seed)
  if [[ ! -e /etc/careeragency/auth.env ]]; then
    "$release/.venv/bin/python" - <<'PY'
import json
from pathlib import Path
from cryptography.fernet import Fernet
values={'CAREER_AUTH_DATABASE_URL':'dbname=careeragency_auth user=careeragency_auth host=/var/run/postgresql',
 'CAREER_AUTH_PUBLIC_ORIGIN':'https://careeragency.ch','CAREER_AUTH_TOTP_KEY':Fernet.generate_key().decode(),
 'CAREER_APP_ROOT':'/opt/careeragency/auth-current/dashboard','CAREER_PUBLIC_FEED':'/srv/careeragency-public/lehrstellen.json',
 'CAREER_AUTH_MAIL_FROM':'noreply@careeragency.ch','CAREER_AUTH_SMTP_HOST':'','CAREER_AUTH_SMTP_PORT':'587',
 'CAREER_AUTH_SMTP_USER':'','CAREER_AUTH_SMTP_PASS':''}
p=Path('/etc/careeragency/auth.env');p.write_text(''.join(k+'='+json.dumps(v)+'\n' for k,v in values.items()));p.chmod(0o600)
PY
  fi
  printf '%s\n' 'CAREER_CRAWLER_DATABASE_URL="dbname=careeragency_auth user=careeragency_crawler host=/var/run/postgresql"' 'CAREER_CRAWLER_FEED=/srv/careeragency-public/lehrstellen.json' > /etc/careeragency/crawler.env
  if [[ ! -f /etc/careeragency/crawler.json ]]; then
    printf '%s\n' '{"enabled":false,"reuse_approved":false,"approval_reference":"","canton":"ZH","max_pages":40,"max_details":500}' > /etc/careeragency/crawler.json
  fi
  chown root:careeragency_crawler /etc/careeragency/crawler.json
  chmod 0640 /etc/careeragency/crawler.json
  # The crawler needs directory traverse but cannot read auth.env (0600).
  chmod 0711 /etc/careeragency
  for unit in "$src"/ops/production/careeragency-{auth.service,mail.service,mail.timer,crawler.service,crawler.timer,ops-alert@.service}; do
    install -m 0644 "$unit" /etc/systemd/system/
  done
  systemctl daemon-reload
  runuser -u careeragency_auth -- psql -XAt -d careeragency_auth -c 'SELECT count(*) FROM career_auth.users' >/dev/null
  log "production_prepare=complete backup=$backup code=$sha service_not_started=true"
  echo 'Next: sudo python3 ops/production/configure-auth.py; then bootstrap the administrator locally and run activate.'
  exit
fi
# Activate only a fully prepared, secret-configured, locally bootstrapped installation.
python3 "$src/ops/production/production_rollout.py" env /etc/careeragency/auth.env
[[ -L /opt/careeragency/auth-current && $(stat -c %U /opt/careeragency/auth-current) == root ]] || exit 65
runtime=$(readlink -f /opt/careeragency/auth-current)
[[ "$runtime" =~ ^/opt/careeragency/auth-releases/([a-f0-9]{40})$ ]] || exit 65
staged_sha=${BASH_REMATCH[1]}
bash "$src/ops/production/check-runtime-source.sh" "$src" "$staged_sha" "$sha"
# Preserve the encryption key/SMTP configuration in the same root-only release backup.
cp -p /etc/careeragency/auth.env "$backup/auth.env"
admins=$(runuser -u postgres -- psql -XAt -d careeragency_auth -c "SELECT count(*) FROM career_auth.users WHERE role='admin' AND status='active'")
[[ "$admins" -ge 1 ]] || { echo 'Create the first administrator interactively before activation'; exit 69; }
python3 "$src/ops/production/production_rollout.py" caddy /etc/caddy/Caddyfile "$backup/Caddyfile.next"
caddy validate --config "$backup/Caddyfile.next" --adapter caddyfile
cp -p "$live/index.html" "$backup/index.html"
cp -p "$live/github-sync.js" "$backup/github-sync.js"
rollback() {
  cp -p "$backup/Caddyfile" /etc/caddy/Caddyfile
  systemctl reload caddy || true
  cp -p "$backup/index.html" "$live/index.html"
  cp -p "$backup/github-sync.js" "$live/github-sync.js"
  if [[ -f "$backup/mode-nav.js" ]]; then cp -p "$backup/mode-nav.js" "$live/mode-nav.js"; fi
  if [[ -f "$backup/radar.js" ]]; then cp -p "$backup/radar.js" "$live/radar.js"; fi
  systemctl stop careeragency-auth.service careeragency-mail.timer || true
  # Security lockdown is retained; personal data is never republished on rollback.
  log "production_activate=rolled_back backup=$backup"
}
trap rollback ERR
systemctl start careeragency-auth.service
for i in {1..20}; do curl -fsS http://127.0.0.1:8765/healthz >/dev/null && break; sleep 1; done
curl -fsS http://127.0.0.1:8765/healthz >/dev/null
for name in feedback.json; do
  if [[ -f "$live/$name" ]]; then mv "$live/$name" "$backup/$name"; fi
 done
install -m 0644 "$src/dashboard/index.html" "$live/index.html"
install -m 0644 "$src/dashboard/github-sync.js" "$live/github-sync.js"
cp -p "$live/mode-nav.js" "$backup/mode-nav.js"
install -m 0644 "$src/dashboard/mode-nav.js" "$live/mode-nav.js"
cp -p "$live/radar.js" "$backup/radar.js"
install -m 0644 "$src/dashboard/radar.js" "$live/radar.js"
cp "$backup/Caddyfile.next" /etc/caddy/Caddyfile
systemctl reload caddy
python3 "$src/ops/production/smoke-production.py"
systemctl enable careeragency-auth.service careeragency-mail.timer
systemctl start careeragency-mail.timer
# Source approval cannot be inferred from technical reachability.
if /opt/careeragency/auth-current/.venv/bin/python -c 'from crawler.production import config;config("/etc/careeragency/crawler.json")'; then
  systemctl enable --now careeragency-crawler.timer
else
  log 'crawler_timer=disabled source_approval_missing=true'
fi
trap - ERR
log "production_activate=complete backup=$backup code=$sha"
