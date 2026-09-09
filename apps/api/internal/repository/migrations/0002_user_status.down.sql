DROP INDEX IF EXISTS users_status_idx;

ALTER TABLE users
    DROP COLUMN IF EXISTS status;

DROP TYPE IF EXISTS user_status;
