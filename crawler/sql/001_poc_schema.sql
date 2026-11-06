-- Career.Agency isolated apprenticeship POC schema.
-- Run ONLY against careeragency_test after verifying current_database().
-- No user/application data, no data migration, no production integration.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'careeragency_test' THEN
    RAISE EXCEPTION 'Refusing schema installation outside careeragency_test';
  END IF;
END
$$;
CREATE SCHEMA IF NOT EXISTS apprenticeship_poc;
CREATE TABLE IF NOT EXISTS apprenticeship_poc.sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_-]{1,63}$'),
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS apprenticeship_poc.import_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id bigint NOT NULL REFERENCES apprenticeship_poc.sources(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  snapshot_complete boolean NOT NULL DEFAULT false,
  seen_count integer NOT NULL DEFAULT 0 CHECK (seen_count >= 0),
  error_message text,
  CHECK ((status='running' AND completed_at IS NULL) OR
         (status<>'running' AND completed_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS apprenticeship_poc.listings (
  id text PRIMARY KEY CHECK (id LIKE 'apprenticeship-%'),
  source_id bigint NOT NULL REFERENCES apprenticeship_poc.sources(id),
  source_listing_id text NOT NULL,
  source_url text NOT NULL CHECK (source_url ~ '^https?://'),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  company text NOT NULL CHECK (length(trim(company)) > 0),
  location text NOT NULL CHECK (length(trim(location)) > 0),
  profession text,
  start_year smallint CHECK (start_year BETWEEN 2020 AND 2100),
  application_url text,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  availability text NOT NULL DEFAULT 'active'
    CHECK (availability IN ('active','temporarily_unreachable','possibly_closed','confirmed_closed')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  content_changed_at timestamptz NOT NULL DEFAULT now(),
  last_import_run_id bigint REFERENCES apprenticeship_poc.import_runs(id),
  missing_count integer NOT NULL DEFAULT 0 CHECK (missing_count >= 0),
  UNIQUE (source_id, source_listing_id)
);
CREATE INDEX IF NOT EXISTS listings_availability_idx
  ON apprenticeship_poc.listings (availability, start_year);
CREATE INDEX IF NOT EXISTS listings_source_seen_idx
  ON apprenticeship_poc.listings (source_id, last_seen_at DESC);
COMMIT;
