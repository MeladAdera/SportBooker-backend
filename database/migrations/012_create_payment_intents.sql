-- =========================
-- Migration 012: Create Payment Intents
-- =========================
-- Description: Tracks Ziina top-up lifecycle per user/tenant.
--   payment_intent_status enum is defined in 001_create_enums.sql.
-- Dependencies: 001, 002, 003
-- =========================

CREATE TABLE IF NOT EXISTS payment_intents (
  id                UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  ziina_payment_id  TEXT                   NOT NULL UNIQUE,
  user_id           UUID                   NOT NULL REFERENCES users(id),
  tenant_id         UUID                   NOT NULL REFERENCES tenants(id),
  amount            NUMERIC(10, 2)         NOT NULL CHECK (amount > 0),
  currency_code     CHAR(3)                NOT NULL DEFAULT 'AED',
  status            payment_intent_status  NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_tenant_user ON payment_intents (tenant_id, user_id);
