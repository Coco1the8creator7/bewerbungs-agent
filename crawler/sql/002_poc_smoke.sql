-- Run after 001_poc_schema.sql, only in an isolated test DB.
-- Transaction rolls back every inserted fixture row.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'careeragency_test' THEN
    RAISE EXCEPTION 'Wrong database';
  END IF;
END
$$;
INSERT INTO apprenticeship_poc.sources (code, display_name)
VALUES ('synthetic', 'Synthetic fixture')
ON CONFLICT (code) DO UPDATE SET display_name=EXCLUDED.display_name;
INSERT INTO apprenticeship_poc.listings
  (id, source_id, source_listing_id, source_url, title, company, location, content_hash)
SELECT 'apprenticeship-smoke-001', id, 'smoke-001',
  'https://example.org/smoke', 'Informatiker/in EFZ',
  'Fiktive Muster AG', 'Luzern LU', repeat('a',64)
FROM apprenticeship_poc.sources WHERE code='synthetic'
ON CONFLICT (source_id, source_listing_id) DO UPDATE SET
  last_seen_at=now(),
  title=CASE WHEN apprenticeship_poc.listings.content_hash IS DISTINCT FROM EXCLUDED.content_hash
              THEN EXCLUDED.title ELSE apprenticeship_poc.listings.title END,
  content_hash=EXCLUDED.content_hash;
-- Reimport, same source identity: must not add a second row.
INSERT INTO apprenticeship_poc.listings
  (id, source_id, source_listing_id, source_url, title, company, location, content_hash)
SELECT 'apprenticeship-smoke-001', id, 'smoke-001',
  'https://example.org/smoke', 'Informatiker/in EFZ',
  'Fiktive Muster AG', 'Luzern LU', repeat('a',64)
FROM apprenticeship_poc.sources WHERE code='synthetic'
ON CONFLICT (source_id, source_listing_id) DO UPDATE
  SET last_seen_at=now();
DO $$
BEGIN
  IF (SELECT count(*) FROM apprenticeship_poc.listings WHERE source_listing_id='smoke-001') <> 1 THEN
    RAISE EXCEPTION 'Duplicate count failed';
  END IF;
END
$$;
ROLLBACK;
