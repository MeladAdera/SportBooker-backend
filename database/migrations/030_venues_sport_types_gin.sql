-- =========================
-- Migration 030: GIN index on venues.sport_types
-- =========================
-- Supports efficient sport_types @> ARRAY[...] filters in browse/count queries.
-- =========================

CREATE INDEX IF NOT EXISTS idx_venues_sport_types_gin ON venues USING GIN (sport_types);
