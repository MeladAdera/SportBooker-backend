-- =========================
-- Migration 018: Add used_at to password_reset_tokens
-- =========================
-- Description: Track when reset token was consumed (single-use)
-- Dependencies: 011
-- =========================

ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
