-- Private non-dossier state. Ownership always comes from the authenticated session.
BEGIN;
CREATE SCHEMA IF NOT EXISTS career_private;
REVOKE ALL ON SCHEMA career_private FROM PUBLIC;
CREATE TABLE career_private.user_state (
 user_id uuid NOT NULL REFERENCES career_auth.users(id) ON DELETE CASCADE,
 key text NOT NULL CHECK (key IN ('workspace','swipes','radar','profile','last-visit','feedback')),
 data jsonb NOT NULL,
 revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,key),
 CHECK (octet_length(data::text) <= 5000000)
);
REVOKE ALL ON career_private.user_state FROM PUBLIC;
-- Defense in depth: the app sets this transaction-local value from its verified session.
ALTER TABLE career_private.user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_private.user_state FORCE ROW LEVEL SECURITY;
CREATE POLICY own_state ON career_private.user_state
 USING (user_id = nullif(current_setting('career.user_id',true),'')::uuid)
 WITH CHECK (user_id = nullif(current_setting('career.user_id',true),'')::uuid);
COMMIT;
