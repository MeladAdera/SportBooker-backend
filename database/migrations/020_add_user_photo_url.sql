-- =========================
-- Migration 020: User profile photo URL
-- =========================
-- Nullable URL for avatar; used by GET /users/me (photoUrl).
-- =========================

ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url VARCHAR(2048);
