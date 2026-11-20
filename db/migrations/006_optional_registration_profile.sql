-- Existing profiles stay intact. NULL means not yet supplied.
-- Older application versions remain compatible with this relaxed constraint.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE career_auth.users ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE career_auth.users ALTER COLUMN residence DROP NOT NULL;
ALTER TABLE career_auth.users DROP CONSTRAINT user_names_not_blank;
ALTER TABLE career_auth.users ADD CONSTRAINT user_names_not_blank CHECK (
    length(trim(first_name)) > 0
    AND (last_name IS NULL OR length(trim(last_name)) > 0)
    AND (residence IS NULL OR length(trim(residence)) > 0)
);
COMMIT;
