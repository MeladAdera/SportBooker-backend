-- =========================
-- Migration 031: booking position (field vs goalkeeper)
-- =========================
-- Description: Role per booking; max 2 goalkeepers enforced in application layer.
-- Dependencies: 006_create_bookings.sql, 001_create_enums.sql
-- =========================

DO $$
BEGIN
  CREATE TYPE booking_position AS ENUM ('field_player', 'goalkeeper');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS position booking_position NOT NULL DEFAULT 'field_player';

COMMENT ON COLUMN bookings.position IS
  'Playing role for this booking; at most two confirmed goalkeepers per match.';
