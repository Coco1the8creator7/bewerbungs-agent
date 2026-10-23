# Job description enrichment (MVP)

The Gmail importer now attempts to read public job pages for existing or newly found jobs without descriptions. It prefers matching schema.org `JobPosting` JSON-LD and deliberately leaves data unchanged when the structured record is unavailable, too short or title-inconsistent.

## Behaviour
- No paid API, external Python package, browser automation, automatic exclusion, change in score weights, or private feedback handling.
- The existing job ID and original URL remain stable. Merging an existing record preserves previously extracted descriptions.
- Gmail uses the shared import pipeline: up to 10 incoming descriptions, followed by up to 8 older missing descriptions in round-robin order. A request times out after 8 seconds; the workflow has a 10-minute limit.
- Only verified matching JobPosting descriptions of 250–30000 characters are accepted. No HTML fallback is included yet.
- Parser outcomes are logged by category (`enriched`, `no_matching_jobposting`, `http_error`, etc.).
- `description_source: jsonld_jobposting` indicates the method. Unpublished salaries and conditions remain unknown.
- The GitHub Actions workflow runs `tests/test_job_enrichment.py` before importing.

## Operational caveats
- Verify actual jobs.ch HTML responses from the GitHub Actions runner; live HTTP access was not available in the development environment.
- Follow up on `publicjobs.ch` redirect handling and review source terms and robots constraints before broad scraping.
- This original MVP has been reconciled with the newer shared pipeline already on main. The merge retains its redirect checks, ambiguity rejection, URL aliases and rotating backfill; the additional regression tests cover description preservation and extraction. Live source fidelity remains a separate operational check.
- No backfill has been run: `dashboard/jobs.json` was deliberately not changed on this branch.
