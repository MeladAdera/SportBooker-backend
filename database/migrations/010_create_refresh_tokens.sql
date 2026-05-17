-- =========================
-- Migration 010: Create Refresh Tokens
-- =========================
-- Description: JWT refresh token storage
-- Dependencies: 003
-- =========================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
  ON refresh_tokens(expires_at);

-- =========================
-- ROLLBACK SCRIPT (in comments)
-- =========================
/*
BEGIN;
DROP TABLE IF EXISTS refresh_tokens;
COMMIT;
*/
