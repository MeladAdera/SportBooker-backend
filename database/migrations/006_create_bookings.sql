-- =========================
-- Migration 006: Create Bookings
-- =========================
-- Description: User bookings for matches in final state.
--   Includes paid_amount, cancelled_at, refunded_at, position.
--   Partial unique index allows rebook after cancellation.
-- Dependencies: 001, 003, 005
-- =========================

CREATE TABLE IF NOT EXISTS bookings (
  id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID              NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id      UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       booking_status    NOT NULL DEFAULT 'pending',
  position     booking_position  NOT NULL DEFAULT 'field_player',
  paid_amount  NUMERIC(10, 2)    NOT NULL DEFAULT 0,
  cancelled_at TIMESTAMPTZ,
  refunded_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ       NOT NULL DEFAULT now()
);

COMMENT ON COLUMN bookings.paid_amount IS
  'Amount charged for this booking; 0 for waitlist (pending) rows.';
COMMENT ON COLUMN bookings.cancelled_at IS
  'Set when booking is cancelled (including match cancellation).';
COMMENT ON COLUMN bookings.refunded_at IS
  'Set when a payment was refunded to the wallet (confirmed bookings only).';
COMMENT ON COLUMN bookings.position IS
  'Playing role for this booking; at most two confirmed goalkeepers per match.';

CREATE INDEX IF NOT EXISTS idx_bookings_match_id ON bookings(match_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id  ON bookings(user_id);

-- Only one active (pending or confirmed) booking per user per match.
-- Cancelled rows are excluded so a user can rebook after cancellation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_match_user_active
  ON bookings (match_id, user_id)
  WHERE status IN ('pending', 'confirmed');
