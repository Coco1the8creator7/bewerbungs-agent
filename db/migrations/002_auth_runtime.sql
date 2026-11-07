-- Requires 001_auth_foundation.sql. Apply to disposable test DB first.
BEGIN;
ALTER TABLE career_auth.sessions ADD COLUMN mfa_verified_at timestamptz;
ALTER TABLE career_auth.totp_credentials ADD COLUMN last_used_step bigint;
CREATE TABLE career_auth.rate_counters (
  key bytea PRIMARY KEY CHECK(octet_length(key)=32),
  window_until timestamptz NOT NULL,
  attempts integer NOT NULL CHECK(attempts>=0)
);
COMMIT;
