-- Career.Agency authentication foundation (PostgreSQL >= 14)
-- REVIEW BEFORE EXECUTING. Not applied by this commit.
-- Apply once using a dedicated migration account, never from a web request.
BEGIN;

CREATE SCHEMA IF NOT EXISTS career_auth;

CREATE TABLE career_auth.users (
    id uuid PRIMARY KEY,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    residence text NOT NULL,
    birth_date date,
    password_hash text,
    role text NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin')),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'blocked')),
    email_verified_at timestamptz,
    activated_at timestamptz,
    blocked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_email_not_blank CHECK (length(trim(email)) BETWEEN 3 AND 320),
    CONSTRAINT user_names_not_blank CHECK (
        length(trim(first_name)) > 0 AND length(trim(last_name)) > 0
        AND length(trim(residence)) > 0),
    CONSTRAINT active_account_verified CHECK (
        status <> 'active' OR (email_verified_at IS NOT NULL AND password_hash IS NOT NULL))
);
-- Lowercased and trimmed email is the canonical application representation;
-- this index also rejects mixed-case duplicates from other writers.
CREATE UNIQUE INDEX users_email_unique_ci ON career_auth.users (lower(trim(email)));

CREATE TABLE career_auth.one_time_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES career_auth.users(id) ON DELETE CASCADE,
    purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT token_expiry_after_creation CHECK (expires_at > created_at)
);
CREATE INDEX tokens_user_purpose_idx
    ON career_auth.one_time_tokens (user_id, purpose, expires_at);

CREATE TABLE career_auth.sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES career_auth.users(id) ON DELETE CASCADE,
    session_hash bytea NOT NULL UNIQUE CHECK (octet_length(session_hash) = 32),
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CONSTRAINT session_expiry_after_creation CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_active_idx ON career_auth.sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;

CREATE TABLE career_auth.totp_credentials (
    user_id uuid PRIMARY KEY REFERENCES career_auth.users(id) ON DELETE CASCADE,
    encrypted_secret bytea NOT NULL,
    key_version integer NOT NULL CHECK (key_version > 0),
    enabled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- A secret is not enabled until a valid code has been verified.
CREATE TABLE career_auth.recovery_codes (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES career_auth.users(id) ON DELETE CASCADE,
    code_hash bytea NOT NULL CHECK (octet_length(code_hash) = 32),
    created_at timestamptz NOT NULL DEFAULT now(),
    consumed_at timestamptz,
    UNIQUE (user_id, code_hash)
);

CREATE TABLE career_auth.admin_audit (
    id uuid PRIMARY KEY,
    actor_user_id uuid REFERENCES career_auth.users(id) ON DELETE SET NULL,
    target_user_id uuid REFERENCES career_auth.users(id) ON DELETE SET NULL,
    action text NOT NULL CHECK (action IN (
        'activate_user', 'block_user', 'unblock_user',
        'create_admin', 'reset_2fa', 'revoke_sessions')),
    happened_at timestamptz NOT NULL DEFAULT now(),
    context jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_target_time_idx ON career_auth.admin_audit (target_user_id, happened_at DESC);

COMMIT;
