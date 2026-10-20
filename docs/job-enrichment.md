# Job description enrichment (MVP)

The Gmail importer now attempts to read public job pages for existing or newly found jobs without descriptions. It prefers matching schema.org `JobPosting` JSON-LD and deliberately leaves data unchanged when the structured record is unavailable, too short or title-inconsistent.

## Behaviour
- No paid API, external Python package, browser automation, automatic exclusion, change in score weights, or private feedback handling.
- The existing job ID and original URL remain stable. Merging an existing record preserves previously extracted descriptions.
- Up to 15 missing descriptions are attempted per importer run; a request times out after 8 seconds. This is a best-effort bound, not a strict 5-minute total runtime guarantee.
- Only verified matching JobPosting descriptions of 250–30000 characters are accepted. No HTML fallback is included yet.
- Parser outcomes are logged by category (`enriched`, `no_matching_jobposting`, `http_error`, etc.).
- `description_source: jsonld_jobposting` indicates the method. Unpublished salaries and conditions remain unknown.
- The GitHub Actions workflow runs `tests/test_job_enrichment.py` before importing.

## Operational caveats
- Verify actual jobs.ch HTML responses from the GitHub Actions runner; live HTTP access was not available in the development environment.
- Follow up on `publicjobs.ch` redirect handling and review source terms and robots constraints before broad scraping.
- Prevent merging into production until tests are green and the first 5–10 enrichment results have been manually checked for title and job-text fidelity.
- No backfill has been run: `dashboard/jobs.json` was deliberately not changed on this branch.
