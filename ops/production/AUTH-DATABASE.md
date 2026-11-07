# Auth database preparation (new database only)

This installer creates `careeragency_auth` **only if absent** and applies migrations 001 and 002 from the current reviewed `main` SHA. It does not operate on `careeragency_test`, existing databases or user data.

- PostgreSQL globals are backed up first in root-only `/var/backups/careeragency-ops/auth`.
- New role `careeragency_auth` has DML rights only on `career_auth` tables, and no superuser / CREATE DB / CREATE ROLE permission.
- Runtime connects through a local Unix socket as the matching system account (peer auth), with `CAREER_AUTH_DATABASE_URL=postgresql:///careeragency_auth?user=careeragency_auth`. This must be verified against the actual `pg_hba.conf`; never weaken database authentication globally.
- On failure, **no automatic deletion** of the new database or role. Diagnose the partial state instead.
- For later existing production databases: require point-in-time backup, tested restore and explicit migration plan. Do not re-run this first-time bootstrap.
- `CAREER_AUTH_TOTP_KEY` must be retained securely outside GitHub and copied into encrypted offline backup. Losing it prevents decrypting existing MFA secrets.
- SMTP credentials and `/etc/careeragency/auth.env` are never committed.

Run only after the auth runtime preparation in PR #85 has been installed on the server:
```bash
sudo bash ops/production/prepare-auth-database.sh "$(git rev-parse HEAD)"
```

**Not a production release:** It does not start services, publish accounts, configure Caddy, grant /app access, or deploy private documents.
