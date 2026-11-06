# Isolated PostgreSQL POC

**Not production-ready.** Schema installation is guarded to `careeragency_test` and introduces no authenticated user accounts, crawler network access, or API. Execute only after reviewing SQL.

Connection with the current administrator (for manual schema bootstrap only):

```sh
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -d careeragency_test -f crawler/sql/001_poc_schema.sql
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -d careeragency_test -f crawler/sql/002_poc_smoke.sql
```

The smoke check is wrapped in a transaction that always rolls back test data. DDL is idempotent but this is not a general-purpose migration runner. Real import transactions, credential management, source rights, missing-listing lifecycle, intersource deduplication and user isolation are future work.

**Role/authentication:** `careeragency_test` exists as a PostgreSQL role, but that does not prove the OS user `ubuntu` can connect as it. Do not weaken `pg_hba.conf` to `trust` or use superuser privileges in the crawler. A dedicated Unix service account with peer authentication or a private SCRAM-authenticated local connection should be chosen when integrating the persistence adapter.

**Important limitation:** `002_poc_smoke.sql` checks uniqueness and a repeated upsert inside one transaction, not an actual Python-to-PostgreSQL ingestion or concurrent imports. It leaves no permanent fixture rows.
