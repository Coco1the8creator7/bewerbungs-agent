# Yousty Zurich 200-listing pilot

## Scope
- Target: **200 distinct EFZ/EBA apprenticeship profiles** whose JobPosting address
  explicitly has country=CH and region=ZH, starting in 2027 or 2028.
- Discovery: public canton-filtered HTML results pages:
  `/de-CH/lehrstellen/ZH?locale=de-CH&page=N&result_type=main`.
- Hard caps: target <=200; <=40 search pages; <=250 detail requests per invocation.
- Single request stream; random 5–10s pause between public search and detail page
  requests; stop on robots denial and HTTP errors including 403/429.
- SQLite checkpoint, no duplicate re-fetching of accepted/rejected records.
- Optional test-only PostgreSQL write via existing `yousty_db_poc.store`.
  Source `yousty_poc`, `snapshot_complete=false`, production not touched.
- Important: selected site results might contain offers outside Zurich; only
  addresses with explicit ZH + CH are accepted. School offers and missing
  address/date are rejected. Open vacancy status is not verified.
- No background process/systemd timer; no changes to frontend or GitHub main.
- Commercial content reuse/republishing still requires review of Yousty terms.

## Server commands
```sh
cd /tmp/careeragency-crawler-poc
git fetch origin poc/lehrstellen-crawler-isolated
git switch --detach origin/poc/lehrstellen-crawler-isolated
python3 -m unittest crawler.tests.test_yousty_zh_batch -v
```

Only after the tests pass and access rights and workload have been reviewed,
run explicitly as the restricted dedicated test user:

```sh
sudo -u careeragency_test /tmp/careeragency-crawler-venv/bin/python \
  -m crawler.yousty_zh_batch \
  --checkpoint /tmp/yousty-zh-200.sqlite3 \
  --target 200 --max-pages 40 --max-details 250 --commit-test-db
```

Do not run staging-only mode with the same checkpoint; checkpoints record
whether they are tied to committed test DB imports and reject mixed modes.
Do not assume the target is reached: inspect `stopped`, `total_accepted`,
`details_attempted` and `committed`. The target is a maximum, not a guarantee.

Verify (without changing records):
```sh
sudo -u careeragency_test psql -X -P pager=off -d careeragency_test -c "
SELECT s.code, count(*) AS listings
FROM apprenticeship_poc.listings l
JOIN apprenticeship_poc.sources s ON s.id=l.source_id
WHERE s.code='yousty_poc'
GROUP BY s.code;"
```

Known limitations: schema currently retains the city and start year only;
the SQLite checkpoint has detailed job metadata. Full description, exact
street address, a reliable per-year vacancy flag and commercial publication
policy remain separate migration/approval tasks.
