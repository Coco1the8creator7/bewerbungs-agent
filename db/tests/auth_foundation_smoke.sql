-- Run ONLY against a disposable PostgreSQL database after migration 001.
-- psql -v ON_ERROR_STOP=1 -f db/tests/auth_foundation_smoke.sql
-- This script always ROLLBACKs its test data; it does NOT check application authorization.
BEGIN;
INSERT INTO career_auth.users
(id,email,first_name,last_name,residence,password_hash,status,email_verified_at)
VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test@Example.invalid','Ada','Test','Zürich',NULL,'pending',NULL),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','other@example.invalid','Bo','Test','Bern','argon2id-placeholder','active',now());

DO $test$
BEGIN
  -- A case-insensitive duplicate must be rejected.
  BEGIN
    INSERT INTO career_auth.users
    (id,email,first_name,last_name,residence)
    VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            ' test@example.INVALID ','Dup','Test','Basel');
    RAISE EXCEPTION 'FAIL: duplicate email accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Pending unverified users cannot be marked active.
  BEGIN
    UPDATE career_auth.users SET status='active'
    WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'FAIL: unverified user activated';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- No invalid roles.
  BEGIN
    UPDATE career_auth.users SET role='superadmin'
    WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'FAIL: invalid role accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Tokens must contain SHA-256-sized digests, never raw token strings.
  BEGIN
    INSERT INTO career_auth.one_time_tokens
    (id,user_id,purpose,token_hash,expires_at)
    VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'verify_email',decode('abcd','hex'),now()+interval '1 hour');
    RAISE EXCEPTION 'FAIL: short token hash accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$test$;
ROLLBACK;
