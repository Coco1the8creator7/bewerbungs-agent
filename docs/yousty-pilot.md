# Yousty pilot: technical HTML feasibility (06.11.2026)

Decision: prioritize Yousty HTML rather than an API or SDBB LSR for the first experimental adapter. This does not authorize commercial storage, publication or a recurring bulk crawler.

Public page: https://www.yousty.ch/de-CH/lehrstellen

What is verified externally: public search results show employer, job title, location and per-year availability. Actual raw HTML, CSS selectors, pagination and stable underlying listing IDs have **not** been inspected. The current terminal environment had no DNS access to www.yousty.ch, so no live HTML parser claim is made.

Terms: https://www.yousty.ch/de-CH/nutzungsbestimmungen (PDF, 1 June 2019). Commercial use requires written approval; systematic extraction of *user data* and disruptive access are prohibited. Public offer facts are conceptually distinct from personal account data, but permission to republish cannot be inferred.

## Single-page pilot
The `crawler/yousty_probe.py` script checks robots.txt and then makes at most one request for the public search page. It does **not** save raw HTML or personal data, scrape listings, perform pagination, use an API or write into PostgreSQL. If robots cannot be fetched, it stops (fail closed). User agent identifies the diagnostic. No login, CAPTCHA circumvention, stealth headers or proxy rotation.

Run in the isolated branch:

```sh
python3 -m unittest crawler.tests.test_yousty_probe -v
python3 -m crawler.yousty_probe --output /tmp/yousty-probe.json
```

Report contains structural indicators only. Next: inspect the report and obtain a permitted, redacted HTML sample or documented consent before building a source-specific parser. Do not schedule automated fetching or enable commercial republication until rights are clarified.
