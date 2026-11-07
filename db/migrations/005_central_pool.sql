BEGIN;
CREATE SCHEMA career_pool;
REVOKE ALL ON SCHEMA career_pool FROM PUBLIC;
CREATE TABLE career_pool.runs (
 id uuid PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz, status text NOT NULL DEFAULT 'running',
 complete boolean NOT NULL DEFAULT false, seen_count integer NOT NULL DEFAULT 0,
 error_code text
);
CREATE TABLE career_pool.listings (
 id text PRIMARY KEY, source_listing_id text UNIQUE NOT NULL,
 metadata jsonb NOT NULL, content_hash text NOT NULL,
 first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 missing_count integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','unconfirmed','closed'))
);
REVOKE ALL ON ALL TABLES IN SCHEMA career_pool FROM PUBLIC;
COMMIT;
