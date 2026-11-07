#!/usr/bin/env bash
# Resume ONLY the specific first-time auth DB bootstrap interrupted before migration 001.
# Refuses any already-initialized auth schema. Existing databases are never dropped.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077
[[ "$EUID" -eq 0 && $# -eq 0 ]] || { echo "Run: sudo bash ops/production/recover-empty-auth-database.sh"; exit 64; }
src="$(cd "$(dirname "$0")/../.." && pwd)"
test -s "$src/db/migrations/001_auth_foundation.sql"
test -s "$src/db/migrations/002_auth_runtime.sql"
test -f "$src/authservice/asgi.py"
for cmd in psql pg_dump runuser; do command -v "$cmd" >/dev/null || exit 69; done
exec 9>/run/lock/careeragency-auth-db.lock
flock -n 9 || exit 75
db=careeragency_auth
role=careeragency_auth
exists="$(runuser -u postgres -- psql -XAt -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$db'")"
[[ "$exists" == 1 ]] || { echo "Expected auth database missing; refusing recovery"; exit 65; }
role_exists="$(runuser -u postgres -- psql -XAt -d postgres -c "SELECT 1 FROM pg_roles WHERE rolname='$role'")"
[[ "$role_exists" == 1 ]] || { echo "Expected role missing; refusing recovery"; exit 65; }
# Ensure the target is empty. A partial or already live schema requires investigation.
schema="$(runuser -u postgres -- psql -XAt -d "$db" -c "SELECT coalesce(to_regnamespace('career_auth')::text,'none')")"
objects="$(runuser -u postgres -- psql -XAt -d "$db" -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'")"
[[ "$schema" == none && "$objects" == 0 ]] || {
  echo "Existing schema or user objects found: recovery blocked"; exit 73;
}
install -d -o root -g root -m 0700 /var/backups/careeragency-ops/auth
backup="/var/backups/careeragency-ops/auth/pre-recovery-$(date -u +%Y%m%dT%H%M%SZ).dump"
runuser -u postgres -- pg_dump -Fc -d "$db" > "$backup"
test -s "$backup"
chmod 0600 "$backup"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$db" < "$src/db/migrations/001_auth_foundation.sql" >/dev/null
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$db" < "$src/db/migrations/002_auth_runtime.sql" >/dev/null
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$db" <<SQL
REVOKE ALL ON SCHEMA career_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA career_auth TO $role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA career_auth TO $role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA career_auth
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $role;
SQL
runuser -u "$role" -- psql -XAt -d "$db" -c 'SELECT count(*) FROM career_auth.users' >/dev/null || {
  echo "Migrations applied but peer access failed: inspect pg_hba.conf; no public activation"; exit 70;
}
logger -p authpriv.notice -t careeragency-auth "DB_RECOVERY_COMPLETE database=$db"
echo "auth_database=prepared"
echo "auth_migrations=001,002"
echo "auth_existing_other_databases=unchanged"
echo "auth_service=not_started"
