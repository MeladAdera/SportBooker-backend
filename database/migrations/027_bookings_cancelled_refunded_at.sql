-- =========================
-- Migration 027: Bookings — cancelled_at, refunded_at (match cancellation refunds)
-- =========================
-- Dependencies: 006, 026
-- =========================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.cancelled_at IS
  'Set when booking is cancelled (including match cancellation).';

COMMENT ON COLUMN bookings.refunded_at IS
  'Set when a payment was refunded to the wallet (confirmed bookings only).';
