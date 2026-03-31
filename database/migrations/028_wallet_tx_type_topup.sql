-- =========================
-- Migration 028: wallet_tx_type — add topup (distinct from generic credit)
-- =========================
-- Dependencies: 001, 007
-- =========================

DO $$
BEGIN
  ALTER TYPE wallet_tx_type ADD VALUE 'topup';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
