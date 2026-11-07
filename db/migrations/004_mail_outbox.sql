BEGIN;
CREATE TABLE career_auth.mail_outbox (
 id uuid PRIMARY KEY,
 payload bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,
 delivered_at timestamptz,
 last_error text
);
REVOKE ALL ON career_auth.mail_outbox FROM PUBLIC;
CREATE INDEX mail_pending ON career_auth.mail_outbox(next_attempt_at) WHERE delivered_at IS NULL;
COMMIT;
