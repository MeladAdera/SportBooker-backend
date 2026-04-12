-- =========================
-- Migration 011: Create Password Reset Tokens
-- =========================
-- Description: Single-use password reset tokens with used_at tracking.
-- Dependencies: 003
-- =========================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
