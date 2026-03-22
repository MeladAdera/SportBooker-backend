-- =========================
-- Migration 015: Unique match per venue per slot (for idempotent seeds)
-- =========================

CREATE UNIQUE INDEX IF NOT EXISTS matches_venue_scheduled_idx ON matches (venue_id, scheduled_at);
