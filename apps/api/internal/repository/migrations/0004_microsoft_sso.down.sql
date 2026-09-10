ALTER TABLE users DROP CONSTRAINT IF EXISTS users_microsoft_oid_key;
ALTER TABLE users DROP COLUMN IF EXISTS microsoft_oid;
