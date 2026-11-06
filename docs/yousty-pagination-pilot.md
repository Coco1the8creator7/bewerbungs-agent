# Yousty pagination pilot

The crawler prototype reads Yousty public search HTML via `CollectionPage.mainEntity.itemListElement`, not API endpoints or browser automation.

## Scope and boundaries
- Isolated branch: `poc/lehrstellen-crawler-isolated`; no frontend changes.
- Run at most **five** new results pages per command.
- Single-threaded requests, random pauses **5–10 seconds** between successful new page requests.
- Check `robots.txt` before any page requests; stop on denied paths or HTTP errors, including 403/429.
- SQLite checkpoint stored locally outside the production DB. Re-running the same pages skips completed pages.
- Neither detail pages nor PostgreSQL are fetched/modified at this stage.
- Source's reported total (24,078 at test time) is not a verified count of distinct active EFZ/EBA positions.
- This pilot does not grant commercial data reuse permission. Do not schedule or scale to a bulk/production crawl until access and reuse conditions have been checked.

## Commands (Infomaniak development worktree)
```sh
cd /tmp/careeragency-crawler-poc
git fetch origin poc/lehrstellen-crawler-isolated
git switch --detach origin/poc/lehrstellen-crawler-isolated
python3 -m unittest crawler.tests.test_yousty_pagination -v
python3 -m crawler.yousty_pagination --start-page 1 --max-pages 5
python3 - <<'PY'
import sqlite3
con = sqlite3.connect('/tmp/yousty-pagination-pilot.sqlite3')
print('Saved pages:', con.execute('SELECT COUNT(*) FROM pages').fetchone()[0])
print('Unique listings:', con.execute('SELECT COUNT(*) FROM listings').fetchone()[0])
print('Basic EFZ/EBA:', con.execute("SELECT COUNT(*) FROM listings WHERE qualification_group='basic_efz_eba'").fetchone()[0])
PY
```
A return value `stopped` other than `null` indicates incomplete processing. Investigate before continuing.

## Next-stage acceptance gates
- Verify pagination over a small real sample, including unique ID counts.
- Establish legal/contractual conditions for recurring commercial extraction and publication.
- Add robust crawl-run logs, cancellation, retries respecting Retry-After without evading 403/429, monitoring and a refresh strategy.
- Reconcile details only for authorized sources; do not infer vacancy closure from missing pages alone.
- Maintain personal data separation and avoid GitHub-token based user sync.
