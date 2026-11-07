# Existing Career.Agency landing – Yousty ZH test feed

## Objective
Show the validated 185 Yousty listings in the **existing** landing page's
`Meine Inserate` cards and existing popup. No second dashboard, no new
components, no design or navigation changes.

## Unchanged
Landing DOM, styles, modal, swipe controls, Dossiers, Agency, Radar,
review IDs/logic, root Caddy route, GitHub legacy jobs and user files.

## Changed only in isolated branch
- `crawler/yousty_landing_export.py`: read-only PostgreSQL + accepted
  ZH checkpoint -> staged `jobs.json`. Metadata and source link only;
  do not republish full descriptions.
- `dashboard/career-filter.js`: allow verified Yousty apprenticeships,
  preserving the original adult career filter.
- Dedicated Python and Node regression tests.

The frontend **already fetches** `./jobs.json` for the landing and
Radar, so there is no need to modify `index.html` or create new UI.

## Server, stage and verify (no public changes)

```sh
cd /tmp/careeragency-crawler-poc
git fetch origin poc/lehrstellen-crawler-isolated
git switch --detach origin/poc/lehrstellen-crawler-isolated
python3 -m unittest crawler.tests.test_yousty_landing_export -v
node --test tests/yousty-landing-feed.test.mjs
test -f /var/www/careeragency/current/index.html
test -f /var/www/careeragency/current/jobs.json
test -f /var/www/careeragency/current/career-filter.js
sudo -u careeragency_test /tmp/careeragency-crawler-venv/bin/python \
  -m crawler.yousty_landing_export \
  --checkpoint /tmp/yousty-zh-200.sqlite3 \
  --output /tmp/careeragency-landing-staging/jobs.json
sudo -u careeragency_test /tmp/careeragency-crawler-venv/bin/python - <<'PY'
from pathlib import Path
import json
data=json.loads(Path("/tmp/careeragency-landing-staging/jobs.json").read_text())
assert len(data) >= 1
assert len({d["id"] for d in data}) == len(data)
assert all(d["source"] == "yousty.ch" for d in data)
print("Staged jobs:", len(data))
PY
```

## Controlled private demo on the same landing page

**IMPORTANT:** Yousty's reuse terms for third-party commercial redistribution
are not verified. Do not leave the feed publicly accessible. First, review
the existing `/etc/caddy/Caddyfile` and set **server-side basic auth for
the `/jobs.json` route only**, while leaving the existing landing HTML
route intact. Inside the `careeragency.ch` server block, before the
existing unqualified `handle` (order is important with nested routing):

```caddyfile
handle /jobs.json {
    basic_auth {
        demo REPLACE_WITH_FRESH_CADDY_HASH
    }
    header Cache-Control "private, no-store"
    header X-Robots-Tag "noindex, nofollow"
    root * /var/www/careeragency/current
    file_server
}
```

Do not overwrite the whole Caddyfile; the site may already have routing
rules. Generate a new hash with `caddy hash-password`. Test the Caddy
config before reloading. Unauthenticated `/jobs.json` MUST return HTTP
401. Sign in once by opening `https://careeragency.ch/jobs.json` in the
same browser, then reload `https://careeragency.ch/#startseite`.
(The endpoint displays JSON, but the frontend renders it as existing cards.)

## Deploy only after tests/auth/risk review

```sh
sudo install -d -m 0700 /var/backups/careeragency-landing
sudo cp -a /var/www/careeragency/current/jobs.json \
  /var/backups/careeragency-landing/jobs.json.before-yousty
sudo cp -a /var/www/careeragency/current/career-filter.js \
  /var/backups/careeragency-landing/career-filter.js.before-yousty
sudo install -m 0644 /tmp/careeragency-landing-staging/jobs.json \
  /var/www/careeragency/current/jobs.json
sudo install -m 0644 dashboard/career-filter.js \
  /var/www/careeragency/current/career-filter.js
```

Verify `curl -I https://careeragency.ch/` (200) and
`curl -I https://careeragency.ch/jobs.json` (401 unauthenticated);
then open authenticated landing in a browser. If rendering is wrong,
rollback:

```sh
sudo cp -a /var/backups/careeragency-landing/jobs.json.before-yousty \
  /var/www/careeragency/current/jobs.json
sudo cp -a /var/backups/careeragency-landing/career-filter.js.before-yousty \
  /var/www/careeragency/current/career-filter.js
```

This direct server edit is a **temporary demo deployment**. A later
GitHub-Action deployment or release swap may overwrite the files.
Permanent architecture should serve the authenticated central feed
from a read-only backend to the exact same landing card renderer.

## Risks
- POC database `availability='active'` is not proof of currently open
  apprenticeship vacancies; cards display status as unverified.
- The full description is not redistributed; users can open original Yousty.
- Existing local user state can override or affect rendering of some IDs.
- Public access to the raw feed must be blocked until usage terms are
  clarified.
