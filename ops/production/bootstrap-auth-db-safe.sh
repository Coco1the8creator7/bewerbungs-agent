#!/usr/bin/env bash
# Review-first, non-destructive auth DB bootstrap. Never touches other databases.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077
[[ "$EUID" -eq 0 && $# -eq 1 && "$1" =~ ^[a-f0-9]{40}$ ]] || {
  echo "Usage: sudo bash bootstrap-auth-db-safe.sh VERIFIED_MAIN_SHA" >&2; exit 64;
}
src="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$src/prepare-auth-database.sh" && -f "$src/recover-empty-auth-database.sh" ]] || exit 66
command -v psql >/dev/null && id postgres >/dev/null && id careeragency_auth >/dev/null || exit 69
[[ -e /opt/careeragency/auth-current ]] || { echo "Runtime must be staged first"; exit 66; }
exists="$(runuser -u postgres -- psql -XAt -d postgres -c "SELECT 1 FROM pg_database WHERE datname='careeragency_auth'")"
if [[ -z "$exists" ]]; then
  exec bash "$src/prepare-auth-database.sh" "$1"
fi
status="$(runuser -u postgres -- psql -XAt -d careeragency_auth -c "
SELECT CASE
 WHEN to_regclass('career_auth.users') IS NOT NULL
  AND to_regclass('career_auth.sessions') IS NOT NULL
  AND to_regclass('career_auth.rate_counters') IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='career_auth' AND table_name='sessions'
       AND column_name='mfa_verified_at'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='career_auth' AND table_name='totp_credentials'
       AND column_name='last_used_step'
  )
 THEN 'complete'
 WHEN to_regnamespace('career_auth') IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ) THEN 'empty'
 ELSE 'partial' END")"
case "$status" in
  complete)
    runuser -u careeragency_auth -- psql -XAt -d careeragency_auth -c "SELECT count(*) FROM career_auth.users" >/dev/null || {
      echo "Schema exists but runtime role access failed"; exit 73;
    }
    echo "auth_database=already_prepared"; echo "auth_data_modified=false"
    ;;
  empty)
    exec bash "$src/recover-empty-auth-database.sh"
    ;;
  *)
    echo "Existing auth database has unknown or partial schema; no migration was run" >&2
    exit 73
    ;;
esac
