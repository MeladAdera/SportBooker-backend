-- =========================
-- Migration 013: Add preferred_days to users
-- =========================
-- Description: Adds a day_of_week enum type and a preferred_days day_of_week[]
--   column to users to store the days a player prefers to play.
--   DB enforces valid values: monday…sunday. Invalid values are rejected at the DB level.
-- Dependencies: 001, 003
-- =========================

DO $$
BEGIN
  CREATE TYPE day_of_week AS ENUM (
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_days day_of_week[] NOT NULL DEFAULT '{}';
