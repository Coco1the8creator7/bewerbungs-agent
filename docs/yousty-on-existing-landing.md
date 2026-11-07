# Existing Career.Agency landing – Yousty ZH private demonstration

## Objective
Show the already validated 185 ZH apprenticeship records **inside the
approved existing landing page** `Meine Inserate` and existing popup.
No second dashboard, new navigation, style changes or rewrite of `index.html`.

## Scope of implemented changes
- `crawler/yousty_landing_export.py`: read-only test PostgreSQL and
  accepted ZH SQLite checkpoint -> staged jobs.json. Stable DB job IDs,
  title, employer, city, start year, original Yousty link. No original
  full texts are republished.
- `dashboard/career-filter.js`: a narrowly scoped exception for
  source=yousty.ch + stable apprenticeship ID + apprenticeship title +
  EFZ/EBA; pre-existing adult exclusions remain unchanged.
- Python and Node regressions.

The landing and Radar already fetch `./jobs.json`; no modification of
`index.html` required. Users' notes, ratings, Dossiers and source files
are never moved into the public repo.

## Read-only staging and checks (no public changes)

```sh
cd /tmp/careeragency-crawler-poc
git fetch origin poc/lehrstellen-crawler-isolated
git switch --detach origin/poc/lehrstellen-crawler-isolated
python3 -m unittest crawler.tests.test_yousty_landing_export -v
node --test tests/yousty-landing-feed.test.mjs
test -f /var/www/careeragency/current/index.html
test -f /var/www/careeragency/current/career-filter.js
sudo -u careeragency_test /tmp/careeragency-crawler-venv/bin/python \
  -m crawler.yousty_landing_export \
  --checkpoint /tmp/yousty-zh-200.sqlite3 \
  --output /tmp/careeragency-landing-staging/jobs.json
sudo -u careeragency_test /tmp/careeragency-crawler-venv/bin/python - <<'PY'
from pathlib import Path
import json
rows=json.loads(Path("/tmp/careeragency-landing-staging/jobs.json").read_text())
assert len(rows)>0 and len(set(x["id"] for x in rows))==len(rows)
assert all(x["source"]=="yousty.ch" for x in rows)
print("Staged:",len(rows))
PY
```

## Version-safe server delivery, same existing landing page

Keep demo files **outside** the GitHub-managed release so GitHub Actions
cannot accidentally overwrite them. Caddy serves two exact URLs from
`/srv/careeragency-landing-feed`; all other paths continue to come
from the approved existing `/var/www/careeragency/current` site.

Install only AFTER passing tests and reviewing source usage rights:

```sh
sudo install -d -o root -g root -m 0755 /srv/careeragency-landing-feed
sudo install -m 0644 /tmp/careeragency-landing-staging/jobs.json \
  /srv/careeragency-landing-feed/jobs.json
sudo install -m 0644 /tmp/careeragency-crawler-poc/dashboard/career-filter.js \
  /srv/careeragency-landing-feed/career-filter.js
```

Inside the EXISTING Caddy `careeragency.ch` site block, **before the
catchall handle**, add these two handlers. Do **not** remove or replace the
existing Caddyfile or its main site routing:

```caddyfile
handle /jobs.json {
    basic_auth {
        demo REPLACE_WITH_NEW_HASH_FROM_caddy_hash-password
    }
    header Cache-Control "private, no-store"
    header X-Robots-Tag "noindex, nofollow"
    root * /srv/careeragency-landing-feed
    file_server
}
handle /career-filter.js {
    root * /srv/careeragency-landing-feed
    file_server
}
```

Basic Auth protects the private JSON feed. If an unauthenticated visitor
requests the main page, their fetch of `jobs.json` can be rejected; the
existing fallback demo content remains. To see the actual ZH jobs, first
visit `https://careeragency.ch/jobs.json`, sign in, then reload
`https://careeragency.ch/#startseite` in the same browser. Never put
the password in source code or the GitHub repo.

```sh
sudo cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-landing-feed
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -s -o /dev/null -w "Landing: %{http_code}\n" https://careeragency.ch/
curl -s -o /dev/null -w "Protected feed: %{http_code}\n" https://careeragency.ch/jobs.json
curl -s -o /dev/null -w "Filter module: %{http_code}\n" https://careeragency.ch/career-filter.js
```

Expected: main page 200, unauthenticated jobs.json 401, filter JS 200.
If feed returns 200 without login, revert the route immediately.
If error, restore the Caddyfile backup, validate and reload.

## Limitations
- Metadata of Yousty records are derived from a third-party source;
  permission for recurring commercial re-publication is still unverified.
  **Do not open this feed publicly** without clearing its usage rights.
- Status `active` is a DB default, NOT proof the place is still open.
- The new static feed is a demo snapshot, not an automatic DB refresh.
- Existing saved client-side workspace could affect visible counts.
- The final user-specific central PostgreSQL-backed architecture remains
  a later task. A static JSON file is not appropriate for private profiles.
