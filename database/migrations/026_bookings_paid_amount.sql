-- =========================
-- Migration 026: Bookings — paid_amount (for confirmed bookings / refunds)
-- =========================
-- Dependencies: 006
-- =========================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN bookings.paid_amount IS
  'Amount charged for this booking; 0 for waitlist (pending) rows.';
