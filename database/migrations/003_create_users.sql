-- =========================
-- Migration 003: Create Users
-- =========================
-- Description: Users with tenant scoping, soft delete, wallet,
--   name, phone, photo_url, is_active, ban fields, and player profile fields.
-- Dependencies: 001, 002
-- =========================

CREATE TABLE IF NOT EXISTS users (
  id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID            NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email              VARCHAR(255)    NOT NULL,
  password_hash      VARCHAR(255)    NOT NULL,
  name               VARCHAR(255)    NOT NULL,
  phone         BIGINT          NOT NULL DEFAULT 0,
  photo_url     VARCHAR(2048)   NOT NULL DEFAULT '',
  role               user_role       NOT NULL,
  is_active          BOOLEAN         NOT NULL DEFAULT true,
  email_verified_at  TIMESTAMPTZ     DEFAULT now(),
  wallet_balance     NUMERIC(10, 2)  NOT NULL DEFAULT 0,
  -- Ban fields: banned_at non-null means a ban is active.
  -- banned_until null = permanent; non-null = auto-expires when NOW() > banned_until.
  banned_at          TIMESTAMPTZ,
  banned_until       TIMESTAMPTZ,
  ban_reason         TEXT,
  -- Player profile fields (nullable; only relevant for role = 'player')
  date_of_birth      DATE,
  nationality        VARCHAR(100),
  preferred_language VARCHAR(10),
  skill_level        skill_level,
  preferred_position player_position,
  dominant_foot      dominant_foot,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id  ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at  ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_banned_at   ON users(banned_at) WHERE banned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email_verified_at ON users(email_verified_at);
