-- =========================
-- Migration 021: Venues — maps_url, sport_types, is_active
-- =========================
-- For databases that applied 004 before those columns existed.
-- Safe to run after updated 004 on fresh installs (idempotent DDL).
-- =========================

ALTER TABLE venues ADD COLUMN IF NOT EXISTS maps_url TEXT;

ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
UPDATE venues SET is_active = COALESCE(is_active, true);
ALTER TABLE venues ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE venues ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE venues ADD COLUMN IF NOT EXISTS sport_types TEXT[];
UPDATE venues
SET sport_types = ARRAY['generic']::TEXT[]
WHERE sport_types IS NULL;
ALTER TABLE venues ALTER COLUMN sport_types SET NOT NULL;

ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_sport_types_allowed;
ALTER TABLE venues ADD CONSTRAINT venues_sport_types_allowed CHECK (
  sport_types <@ ARRAY['football', 'padel', 'cricket', 'generic']::TEXT[]
  AND cardinality(sport_types) >= 1
);
