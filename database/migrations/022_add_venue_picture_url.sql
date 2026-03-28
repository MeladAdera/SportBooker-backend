-- =========================
-- Migration 022: Venues — optional picture URL
-- =========================

ALTER TABLE venues ADD COLUMN IF NOT EXISTS picture_url VARCHAR(2048);
