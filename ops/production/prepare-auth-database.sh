#!/usr/bin/env bash
# Bootstrap a NEW isolated auth database only. No pre-existing database is changed.
# After code review: sudo bash ops/production/prepare-auth-database.sh <current-main-sha>
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export GIT_TERMINAL_PROMPT=0
umask 077
[[ "$EUID" -eq 0 && $# -eq 1 && "$1" =~ ^[0-9a-f]{40}$ ]] || exit 64
sha="$1"
for cmd in git runuser pg_dumpall psql createdb flock; do
  command -v "$cmd" >/dev/null || { echo "Missing $cmd"; exit 69; }
done
id postgres >/dev/null
id careeragency_auth >/dev/null || {
  echo "Install the isolated backend runtime first (careeragency_auth OS user missing)." >&2; exit 66;
}
exec 9>/run/lock/careeragency-auth-db.lock
flock -n 9 || exit 75
work="$(mktemp -d /tmp/careeragency-auth-db.XXXXXXXX)"
trap 'rm -rf -- "$work"' EXIT
git clone -q --no-checkout https://github.com/Coco1the8creator7/bewerbungs-agent.git "$work/repo"
git -C "$work/repo" fetch -q origin main
[[ "$(git -C "$work/repo" rev-parse origin/main)" == "$sha" ]] || {
  echo "Refusing database setup: sha differs from current main" >&2; exit 65;
}
git -C "$work/repo" checkout -q --detach "$sha"
db=careeragency_auth
role=careeragency_auth
# Fail-closed: never overwrite or migrate an existing database.
exists="$(runuser -u postgres -- psql -XAt -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$db'")"
[[ -z "$exists" ]] || { echo "Database exists; no changes performed"; exit 73; }
migration_a="$work/repo/db/migrations/001_auth_foundation.sql"
migration_b="$work/repo/db/migrations/002_auth_runtime.sql"
[[ -s "$migration_a" && -s "$migration_b" ]] || exit 66
install -d -o root -g root -m 0700 /var/backups/careeragency-ops/auth
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="/var/backups/careeragency-ops/auth/pre-auth-globals-$stamp.sql"
runuser -u postgres -- pg_dumpall --globals-only > "$backup"
test -s "$backup"
chmod 0600 "$backup"
if [[ -z "$(runuser -u postgres -- psql -XAt -d postgres -c "SELECT 1 FROM pg_roles WHERE rolname='$role'")" ]]; then
  runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d postgres -c "CREATE ROLE $role LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION"
fi
runuser -u postgres -- createdb --owner=postgres --encoding=UTF8 --template=template0 "$db"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d postgres -c "REVOKE CONNECT ON DATABASE $db FROM PUBLIC"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d postgres -c "GRANT CONNECT ON DATABASE $db TO $role"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$db" < "$migration_a" >/dev/null
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$db" < "$migration_b" >/dev/null
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$db" <<SQL
REVOKE ALL ON SCHEMA career_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA career_auth TO $role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA career_auth TO $role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA career_auth
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $role;
SQL
if ! runuser -u "$role" -- psql -XAt -d "$db" -c 'SELECT count(*) FROM career_auth.users' >/dev/null; then
  echo "Database migrations completed, but local peer authentication failed." >&2
  echo "Do not start the auth service until pg_hba.conf is verified." >&2
  exit 70
fi
logger -p authpriv.notice -t careeragency-auth "DB_PREPARED sha=$sha db=$db globals_backup=$backup"
printf 'auth_database=prepared\nauth_database_name=%s\nauth_migrations=001,002\nauth_existing_databases=unchanged\n' "$db"
echo "SMTP configuration and route authorization still required. Do not start public service."
