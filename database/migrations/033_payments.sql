-- =========================
-- Migration 033: payments — Ziina integration
--   - Adds ziina_access_token, ziina_webhook_secret to tenants
--   - Creates payment_intents table for tracking top-up lifecycle
-- =========================
-- Dependencies: 002 (tenants), 003 (users)
-- =========================

-- Ziina credentials on the tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS ziina_access_token   text,
  ADD COLUMN IF NOT EXISTS ziina_webhook_secret  text;

-- Track every top-up intent so the webhook can find the right user
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_intent_status') THEN
    CREATE TYPE payment_intent_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS payment_intents (
  id                  uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  ziina_payment_id    text              NOT NULL UNIQUE,
  user_id             uuid              NOT NULL REFERENCES users(id),
  tenant_id           uuid              NOT NULL REFERENCES tenants(id),
  amount              numeric(10, 2)    NOT NULL CHECK (amount > 0),
  currency_code       char(3)           NOT NULL DEFAULT 'AED',
  status              payment_intent_status NOT NULL DEFAULT 'pending',
  created_at          timestamptz       NOT NULL DEFAULT NOW(),
  updated_at          timestamptz       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_tenant_user
  ON payment_intents (tenant_id, user_id);
