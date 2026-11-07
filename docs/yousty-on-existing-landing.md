# Yousty ZH on the EXISTING Career.Agency landing

## Verified code intent
- Existing `#startseite` > `#newJobsList` cards and detail modal, not a separate page.
- `dashboard/index.html` now uses `visibleJobs(){return jobs;}` to show **all** downloaded records.
  Adult-personal exclusion and automatic priority scoring no longer run on the
  landing. Sort defaults to newest instead of priority.
- `dashboard/radar.js` and its adult filter are **unchanged**.
- `crawler/yousty_landing_export.py` reads **only** `careeragency_test`
  + accepted ZH checkpoint. It writes a staged `jobs.json` with metadata,
  not full scraped descriptions.
- Production deployment is **not** automatic: this change is isolated in
  `poc/lehrstellen-crawler-isolated`, not `main`.

## 1. Stage and validate records (no changes to public website)

```bash
cd /tmp/careeragency-crawler-poc
git fetch origin poc/lehrstellen-crawler-isolated
git switch --detach origin/poc/lehrstellen-crawler-isolated
node --test tests/landing-unfiltered.test.mjs tests/yousty-landing-feed.test.mjs
python3 -m unittest crawler.tests.test_yousty_landing_export -v
sudo -u careeragency_test /tmp/careeragency-crawler-venv/bin/python \
  -m crawler.yousty_landing_export \
  --checkpoint /tmp/yousty-zh-200.sqlite3 \
  --output /tmp/careeragency-landing-staging/jobs.json
sudo -u careeragency_test python3 - <<'PY'
import json
from pathlib import Path
rows=json.loads(Path("/tmp/careeragency-landing-staging/jobs.json").read_text())
assert rows and len({x["id"] for x in rows})==len(rows)
assert all(x["source"]=="yousty.ch" for x in rows)
print("Verified staged jobs:", len(rows))
PY
```

## 2. Deploy only the new shared feed and the minimal landing update

Do NOT copy the branch's full `dashboard/` folder or legacy
`dashboard/jobs.json` into the live site. Doing so would overwrite
approved UI or reintroduce old adult job records.

```bash
sudo install -d -m 0755 /srv/careeragency-landing-feed
sudo install -m 0644 /tmp/careeragency-landing-staging/jobs.json \
  /srv/careeragency-landing-feed/jobs.json
sudo install -d -m 0700 /var/backups/careeragency-landing
```

To avoid replacing a live `index.html` that has diverged from the
repository main version, make a strict byte-for-byte comparison before
copying the tested branch's `index.html`:

```bash
cd /tmp/careeragency-crawler-poc
git fetch origin main
if cmp -s <(git show origin/main:dashboard/index.html) /var/www/careeragency/current/index.html; then
  sudo cp -a /var/www/careeragency/current/index.html \
    /var/backups/careeragency-landing/index.html.before-yousty
  sudo install -m 0644 dashboard/index.html /var/www/careeragency/current/index.html
  echo "Landing patch installed (approved layout unchanged)"
else
  echo "STOP: live index.html differs from origin/main; do not overwrite."
fi
```

If the comparison fails, **inspect and apply a minimal patch**, not a
blind full-file overwrite. A later GitHub Action deploy from `main`
can revert this temporary server-only `index.html` patch.

## 3. Caddy must serve the live protected jobs feed

With the existing `careeragency.ch` block, before catch-all `handle`:

```caddyfile
handle /jobs.json {
    basic_auth {
        demo YOUR_FRESH_CADDY_BCRYPT_HASH
    }
    header Cache-Control "private, no-store"
    header X-Robots-Tag "noindex, nofollow"
    root * /srv/careeragency-landing-feed
    file_server
}
```

The `/career-filter.js` Caddy override from the old deployment guide
is no longer needed for the new landing; Radar may continue using the
existing script. Do not overwrite or reveal the authentication hash.
Run `sudo caddy validate --config /etc/caddy/Caddyfile`, then reload
only if validation passes.

```bash
test -s /srv/careeragency-landing-feed/jobs.json
curl -s -o /dev/null -w "Startseite: %{http_code}\n" https://careeragency.ch/
curl -s -o /dev/null -w "Feed ohne Login: %{http_code}\n" https://careeragency.ch/jobs.json
```

Expected: start 200, feed 401. For browser demo, first visit
`https://careeragency.ch/jobs.json` and sign in, then visit
`https://careeragency.ch/#startseite`. Protected `fetch()` can fail
before the browser has authenticated; the old demo fallback is NOT proof
that the site has imported zero Yousty records.

## Risks and acceptance
- Does not make Yousty automatically crawled/synced; this is a one-time snapshot.
- Individual listing availability is not independently verified.
- Public commercial re-publication rights from Yousty have not been cleared.
- No production confirmation until HTTPS + browser card count checked.
- Personal ratings and stored dossiers must remain untouched.
- Rollback: restore backed-up `index.html` and prior Caddy route; staged
  Yousty data remains isolated and can be withdrawn without deleting SQL.
