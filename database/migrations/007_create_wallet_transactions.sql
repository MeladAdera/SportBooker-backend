-- =========================
-- Migration 007: Create Wallet Transactions
-- =========================
-- Description: Wallet transaction history.
--   wallet_tx_type includes: credit, debit, refund, topup.
-- Dependencies: 001, 003
-- =========================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       NUMERIC(10, 2)  NOT NULL,
  type         wallet_tx_type  NOT NULL,
  reference_id UUID,
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id    ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);
