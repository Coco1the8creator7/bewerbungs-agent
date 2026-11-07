# Passwortgeschützte Yousty-Demovorschau (Infomaniak)

Goal: View the **already imported** and independently ZH-validated Yousty
pilot records in a browser without touching the approved Career.Agency UI or
its old Gmail-related files.

## Design and security boundaries

- Only `careeragency_test`, PostgreSQL role `careeragency_test`,
  source `yousty_poc`; no production DB/API/backend or authenticated user data.
- Cross-check every row against `/tmp/yousty-zh-200.sqlite3` with
  `outcome='accepted'`, verified CH/ZH detail address and EFZ/EBA title.
- Only title, employer, **city**, start year and original Yousty hyperlink.
  No source full descriptions, logos or application data are published.
- Standalone preview under `/srv/careeragency-lehrstellen-preview`, separate
  from the Caddy dashboard webroot. Do not put the SQLite DB or raw HTML there.
- The route must use **server-side HTTP Basic Auth over HTTPS**. The noindex
  meta tag does not substitute authentication. No unprotected route.
- Yousty commercial reuse rights remain unclear; this limits access but
  does not itself grant redistribution rights. Do not use this pilot as a
  permanent public job feed or schedule recurring scrapes.

## 1. Export an isolated HTML file on the server

```sh
cd /tmp/careeragency-crawler-poc
git fetch origin poc/lehrstellen-crawler-isolated
git switch --detach origin/poc/lehrstellen-crawler-isolated
python3 -m unittest crawler.tests.test_yousty_preview_export -v
sudo install -d -m 0755 -o careeragency_test -g careeragency_test /srv/careeragency-lehrstellen-preview
sudo -u careeragency_test /tmp/careeragency-crawler-venv/bin/python \
  -m crawler.yousty_preview_export \
  --checkpoint /tmp/yousty-zh-200.sqlite3 \
  --output /srv/careeragency-lehrstellen-preview/index.html
```

The export fails if any `accepted` checkpoint ID is missing from SQL, if any
validated source detail is outside ZH or is not EFZ/EBA, or if SQL is not
`careeragency_test` with its limited role.

## 2. Route via the existing Caddy site, with password

**Do not blindly overwrite** `/etc/caddy/Caddyfile`. Verify the existing
`careeragency.ch` site block, backup the file and insert the following
routing block **inside the matching site block**, adapting placement to its
existing `handle`/`route` directives:

```caddyfile
handle_path /lehrstellen-demo/* {
    basic_auth {
        demo INSERT_CADDY_GENERATED_PASSWORD_HASH_HERE
    }
    header Cache-Control "private, no-store"
    header X-Robots-Tag "noindex, nofollow"
    root * /srv/careeragency-lehrstellen-preview
    file_server
}
```

Generate a **new strong** password with `caddy hash-password` interactively
and keep it out of GitHub, terminal chat and shared logs. Store the hash in
the Caddyfile; only the user keeps the password.

```sh
sudo cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-lehrstellen-demo
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -I https://careeragency.ch/lehrstellen-demo/
```

Without credentials, the endpoint **must return 401**, not 200 or 404.
If it returns 200, take the preview offline until authentication is fixed.
Once verified, navigate to `https://careeragency.ch/lehrstellen-demo/`
and sign in with the configured demo user/password.

If validation fails, restore the Caddyfile backup and validate/reload.
Never relax authentication just to make the page load.

## Acceptance and future migration

- Count and presence of records on page must agree with export result.
- Test search (title, employer, city) and start-year filter.
- Main dashboard/Radar stay unchanged; this is a dedicated read-only demo.
- Restore to production only with legal/contractual data-source permission and
  an authenticated backend feeding the existing UI from a shared central DB.
