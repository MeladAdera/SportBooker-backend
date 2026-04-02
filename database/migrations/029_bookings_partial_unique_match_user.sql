-- =========================
-- Migration 029: Partial unique on bookings (match_id, user_id) for active rows only
-- =========================
-- Allows a new booking after a previous one was cancelled (rebook flow).
-- Replaces table UNIQUE (match_id, user_id) with a partial unique index.
-- Dependencies: 006_create_bookings.sql
-- =========================

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_match_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_match_user_active
  ON bookings (match_id, user_id)
  WHERE status IN ('pending', 'confirmed');
