BEGIN;

-- =========================
-- Migration 006: Create Bookings
-- =========================
-- Description: User bookings for matches, UNIQUE(match_id, user_id)
-- Dependencies: 001, 003, 005
-- =========================

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status booking_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_match_id ON bookings(match_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);

COMMIT;

-- =========================
-- ROLLBACK SCRIPT (in comments)
-- =========================
/*
BEGIN;
DROP TABLE IF EXISTS bookings;
COMMIT;
*/
