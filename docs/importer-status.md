# Importer implementation status — 2026-10-17

Implemented prototype: offline EML ingestion; optional Mac Gmail API OAuth read-only mode; simple generic HTML link extraction; multiple links per mail; tracking cleanup; canonical URL deduplication; SQLite message digests and sightings; JSON dashboard export; synthetic unittest suite.

Not validated: sender-specific real HTML layout extraction, company/location extraction, redirect expansion, real Gmail API OAuth connection and live-run; no job data committed. Connected Gmail search yielded zero results on initial and sender-specific searches. Do not assume the source confirmations in config are recent observed inbox evidence.

Design constraints: Never dedupe solely on title; differing URLs remain separate until source IDs or confirmed canonical URLs establish identity. Job-alert link text can be non-titles. Placeholder title and warning are deliberate for ambiguous links. Known-sender messages without plausible links are retained in message status as review, but not fabricated as jobs. SQLite resides locally; JSON export uses existing v0.1.0 schema.

Enrichment proposal (not implemented): fetch job pages only where site terms/robots/access permissions permit; rate limit and cache ETag/Last-Modified; no bypass of authentication, CAPTCHA or paywalls; preserve source URL and fetched-at timestamp. Future OpenAI API adapter receives minimized job text and returns validated structured fields; call only after deterministic parser fails or essential fields absent. Do not send complete private emails by default. User profile and matching explicitly out of scope.
