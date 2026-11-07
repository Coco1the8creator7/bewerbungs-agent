#!/usr/bin/env bash
# Additive migrations, checksummed ledger, one shared lock; never downgrade/drop data.
set -euo pipefail
[[ $EUID == 0 && $# -ge 1 && $# -le 2 ]] || exit 64
src=$1
db=${2:-careeragency_auth}
[[ "$db" == careeragency_auth || "$db" =~ ^careeragency_restore_[a-f0-9]{12}$ ]] || exit 64
work=$(mktemp)
trap 'rm -f "$work"' EXIT
cat > "$work" <<'SQL'
SELECT pg_advisory_lock(hashtextextended('careeragency-migrations',0));
CREATE SCHEMA IF NOT EXISTS career_ops;
REVOKE ALL ON SCHEMA career_ops FROM PUBLIC;
CREATE TABLE IF NOT EXISTS career_ops.migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());
SQL
for file in "$src"/db/migrations/[0-9][0-9][0-9]_*.sql; do
 name=$(basename "$file")
 checksum=$(sha256sum "$file" | cut -d' ' -f1)
 # Inputs are root-reviewed repository filenames/checksums, never caller SQL.
 [[ "$name" =~ ^[0-9]{3}_[a-z_]+\.sql$ && "$checksum" =~ ^[a-f0-9]{64}$ ]] || exit 65
 cat >> "$work" <<SQL
DO \$\$ BEGIN IF EXISTS(SELECT 1 FROM career_ops.migrations WHERE name='$name' AND checksum<>'$checksum') THEN RAISE EXCEPTION 'Migration checksum mismatch'; END IF; END \$\$;
SELECT EXISTS(SELECT 1 FROM career_ops.migrations WHERE name='$name') AS applied \gset
\if :applied
\else
SQL
 # Adopt only the known pre-ledger auth foundation; reject partial installations.
 if [[ "$name" == 001_* ]]; then
  cat >> "$work" <<'SQL'
SELECT to_regclass('career_auth.users') IS NOT NULL AS legacy \gset
\if :legacy
DO $$ BEGIN
 IF to_regclass('career_auth.sessions') IS NULL OR to_regclass('career_auth.one_time_tokens') IS NULL OR
 to_regclass('career_auth.totp_credentials') IS NULL OR to_regclass('career_auth.recovery_codes') IS NULL OR
 to_regclass('career_auth.admin_audit') IS NULL THEN RAISE EXCEPTION 'Partial legacy auth schema; investigate'; END IF;
END $$;
\else
SQL
 elif [[ "$name" == 002_* ]]; then
  cat >> "$work" <<'SQL'
SELECT to_regclass('career_auth.rate_counters') IS NOT NULL AS legacy \gset
\if :legacy
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='career_auth' AND table_name='sessions' AND column_name='mfa_verified_at') OR
 NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='career_auth' AND table_name='totp_credentials' AND column_name='last_used_step') THEN RAISE EXCEPTION 'Partial runtime migration'; END IF;
END $$;
\else
SQL
 fi
 echo 'BEGIN;' >> "$work"
 # Existing migrations contain one outer transaction. Ledger entry shares that transaction.
 sed '/^BEGIN;$/d; /^COMMIT;$/d' "$file" >> "$work"
 printf "\nINSERT INTO career_ops.migrations(name,checksum) VALUES('%s','%s');\nCOMMIT;\n" "$name" "$checksum" >> "$work"
 if [[ "$name" == 001_* || "$name" == 002_* ]]; then
  printf '%s\n' '\endif' >> "$work"
  printf "INSERT INTO career_ops.migrations(name,checksum) VALUES('%s','%s') ON CONFLICT DO NOTHING;\n" "$name" "$checksum" >> "$work"
 fi
 printf '\\endif\n' >> "$work"
done
cat >> "$work" <<'SQL'
REVOKE ALL ON SCHEMA career_auth FROM PUBLIC;
REVOKE CONNECT ON DATABASE :"target_db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"target_db" TO careeragency_auth,careeragency_crawler;
GRANT USAGE ON SCHEMA career_auth,career_private TO careeragency_auth;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA career_auth,career_private TO careeragency_auth;
GRANT USAGE ON SCHEMA career_pool TO careeragency_crawler;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA career_pool TO careeragency_crawler;
SELECT pg_advisory_unlock(hashtextextended('careeragency-migrations',0));
SQL
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -v target_db="$db" -d "$db" < "$work" >/dev/null
