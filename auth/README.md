# Authentication security core – NOT deployable

Scope: dependency-light Python security helpers and isolated tests; no HTTP endpoints,
database access, automatic emails, session storage, TOTP enrollment or production
access checks have been implemented here.

This module uses Argon2id for password hashing and cryptographically random opaque
secrets; store only SHA-256 digests of randomly issued bearer tokens. Role/status
decisions are *helpers only* and **do not** replace per-request authorization checks.

Planned integration requires: server-side session lookup with immediate block/revoke
enforcement; SQL transaction and row lock when consuming one-time tokens; password
recovery emails and message queue; CSRF protection; registration/login throttling;
TOTP using a reviewed library plus server-side replay prevention; secure SameSite
cookies; permissions and tenant isolation; test PostgreSQL and staging deployment.

Run locally after installing dependencies:
```sh
python -m pip install -r auth/requirements.txt
python -m unittest discover -s auth/tests -v
```

Design decision: no changes to existing dashboard UI, crawler, public landing page
or live Caddy configuration. Do not expose API endpoints before the complete,
tested authorization pipeline exists.
