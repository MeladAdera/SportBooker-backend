-- =========================
-- Migration 003: Create Users
-- =========================
-- Description: Users with tenant scoping, soft delete, wallet,
--   name, phone, photo_url, is_active.
-- Dependencies: 001, 002
-- =========================

CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  phone         BIGINT          NOT NULL DEFAULT 0,
  photo_url     VARCHAR(2048)   NOT NULL DEFAULT '',
  role          user_role     NOT NULL,
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  wallet_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id  ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at  ON users(deleted_at);
