-- =========================
-- Migration 014: Add fake entity flags
-- =========================
-- Description: Adds is_fake to users and matches, plus min_real_spots
--   to matches so tenant admins can seed demo data while reserving
--   capacity for real players.
--   - users.is_fake: blocks login, skips notifications, excludes from
--     financial reports.
--   - matches.is_fake + matches.min_real_spots: caps fake bookings at
--     (max_players - min_real_spots) so real players can always join.
--   - users.password_hash made nullable so fake users do not carry
--     a meaningless secret.
-- Dependencies: 001, 003, 005
-- =========================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_fake BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS is_fake BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS min_real_spots SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_min_real_spots_valid;

ALTER TABLE matches
  ADD CONSTRAINT matches_min_real_spots_valid
  CHECK (
    min_real_spots >= 0
    AND (max_players IS NULL OR min_real_spots <= max_players)
  );

CREATE INDEX IF NOT EXISTS idx_users_fake_tenant
  ON users(tenant_id) WHERE is_fake = true;

CREATE INDEX IF NOT EXISTS idx_matches_fake_venue
  ON matches(venue_id) WHERE is_fake = true;
