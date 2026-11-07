# Production completion, excluding Dossier Studio

Status: implementation for review and CI; no live change is implied by this document or a merged PR.

## Scope and decisions

- Keep the free pilot, email verification, manual owner approval and mandatory admin TOTP.
- UI changes are limited to necessary login/register/logout access in the existing sidebar account area and storage wording. Landing cards, Radar layout, Agency art, Dossier Studio and the global design system are unchanged.
- Keep the approved public landing UI. `dashboard/index.html` uses the actual HTML retrieved from careeragency.ch on 7 November 2026, with only account persistence hooks. The rollout compares the live HTML with that reference before replacing it.
- Keep a shared apprenticeship pool and private non-dossier account state in PostgreSQL. `career_private.user_state` stores workspace, swipes, Radar/profile and feedback; server session supplies ownership. Row policies add a second ownership check. No separate database per user.
- Keep Dossier Studio, its editor, export and storage adapters unchanged. Existing local dossiers remain device-local demo data and are **not** made safe for shared-device multiuser use by this release. Do not use real dossiers during the pilot until the separately deferred work is completed.
- No automatic attribution/import of old browser data to a new account. Old IndexedDB and public GitHub history are not deleted. Private unsent filter drafts use an account-specific IndexedDB database; server state is accessed through `/api/user`.
- Retire automatic SFTP, Pages, adult Gmail and manual URL importer deployments. Only reviewed Infomaniak releases should change production. PR #30 (Supabase pilot) is not part of this architecture and must not be merged as-is.

## First installation

The installed server bridge previously allowed status, staging and specific frontend operations. This implementation cannot install its own new privileged gateway through those older actions. The owner must install it once on the trusted server, after merging the reviewed PR. No key removal or unrestricted sudo for the runner is needed.

From a clean checkout of current `main`, as the server administrator:

```sh
sudo bash ops/production/owner-setup.sh
```

The single interactive bootstrap installs the shared SSH dispatcher, removes the live feedback payload into a root-only backup, prepares an isolated runtime, verifies backup restoration, applies checksummed additive SQL migrations, asks for SMTP credentials locally, verifies SMTP TLS/login **without sending an email**, creates the first administrator interactively, then activates routes and executes read-only HTTP checks. Secrets never belong in chat, GitHub issues or command arguments.

The runtime is bound to 127.0.0.1:8765. `/app/` and every private asset are authorized in the ASGI backend; Caddy forwards these routes without a public static fallback. `/healthz` is loopback-only (not a public proxy route). Users without approval or MFA cannot access private data, including static assets. Account/admin pages use the existing auth UI with corrected waiting routing, resend and recovery-code access.

The Caddy patch refuses unknown host layouts, existing private routes and request rewrites/auth directives that could shadow the new handlers. A refusal requires inspection of the actual Caddyfile; **do not replace it blindly**. Runtime setup also refuses an active old auth service or an unknown live index. Existing frontend and database state are preserved in root-only backups. Rollback retains the security lockdown and never restores public feedback.

Phases can be run separately with `apply-production.sh plan|lockdown|prepare|activate`. `plan` is read-only. Source files are taken only from clean current `main`. `prepare` is a first-install path, not a rolling update tool; it intentionally refuses an already existing release. Review any failed partial preparation before retrying.

After that first bootstrap, owner-created exact issue titles `CA-PROD: plan <SHA>`, `CA-PROD: lockdown <SHA>`, `CA-PROD: prepare <SHA>` or `CA-PROD: activate <SHA>` use the scoped GitHub Actions/SSH bridge. The workflow and root wrapper both validate operation and full lowercase SHA; the SHA must match current `main`. Issue bodies are never executed.

## Mail and operational checks

Mail is encrypted in a transactional outbox and retried each minute, up to 8 times with exponential delay. Sent payloads are cleared. Links are not sent after their shortest lifetime. SMTP can deliver twice if the remote accepts mail and the database commit fails: this is at-least-once delivery, not a false exactly-once guarantee. Mail failures remain in `career_auth.mail_outbox`; no addresses or SMTP exception details are logged.

- `journalctl -u careeragency-auth -u careeragency-mail -u careeragency-crawler`
- `journalctl -t careeragency-alert -t careeragency-release -t careeragency-admin`
- `systemctl list-timers 'careeragency-*'`
- root-only backups: `/var/backups/careeragency-ops/production/`

Database dumps are restored into a new, uniquely named verification DB before migration. Restore databases are retained for operator inspection; this first-install tool never drops them. Code/route rollback is automatic on activation-check failure; schema changes are additive and remain. Restoring live database data is a separate explicit decision because it can discard newer data.

## Crawler

The reviewed Yousty JSON-LD/detail parsers are carried over from `poc/lehrstellen-crawler-isolated`. Existing `yousty_poc` stable IDs are preserved so ratings do not detach. The 185-record public feed can seed the central pool without replacing its IDs.

The timer runs at 06:15 and 18:15 Europe/Zurich, with up to 120 seconds jitter, only after a documented source approval in root-managed `/etc/careeragency/crawler.json`:

```json
{"enabled":false,"reuse_approved":false,"approval_reference":"","canton":"ZH","max_pages":40,"max_details":500}
```

`approval_reference` must refer to an actual source-use decision/permission. Neither robots.txt nor a technically successful pilot proves a right to republish. Defaults keep the timer disabled and the existing validated feed available. No live crawl is performed by tests.

The production runner bounds requests, observes robots and minimum 5-second spacing, rejects cross-origin redirects, serializes runs with a PostgreSQL lock and publishes a nonempty feed atomically. Each run is recorded. A failed run preserves the previous export. Pagination completeness requires all unique source IDs and a stable reported total. Capped scans are incomplete and never advance missing counters. Two complete successful scans with absence mark a record `unconfirmed`, not deleted or proven closed; an explicit expired `validThrough` closes it. This adapter covers the existing ZH scope only, not all Swiss apprenticeships.

Failure reporting is currently systemd/journal based; no email/Slack alert recipients were configured. Source expansion, contractual permission, real-run duration and external alert routing remain operational follow-ups.

## Acceptance evidence and remaining gates

CI must pass real PostgreSQL tests for two-account isolation, session/approval gates, direct assets, stale revision rejection, idempotent ratings, RLS under a non-superuser role, outbox transaction rollback/retry, and complete/incomplete/failed crawler snapshots. Offline UI and operational regression tests must also pass.

Still requires live verification: registration and actual email receipt, admin MFA/approval, activation email, two real test accounts across browsers, loss-free autosave/refresh, mobile UI regression, current Caddy routing and source approval. Registration/send actions in production must use agreed test recipients. A passing read-only deployment smoke test alone does not finish product acceptance.

Public GitHub history still contains old prototype data. Disabling its consumers and closing live routes does not erase that history. History rewriting is deliberately excluded; review it separately with the owner before irreversible cleanup.
