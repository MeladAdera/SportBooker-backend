-- =========================
-- Migration 016: Add user name and phone
-- =========================
-- Description: name (required for registration), phone (optional)
-- Dependencies: 003
-- =========================

ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Backfill name for existing rows (e.g. from seed before this migration)
UPDATE users SET name = split_part(email, '@', 1) WHERE name IS NULL;

ALTER TABLE users ALTER COLUMN name SET NOT NULL;
