-- =========================
-- Migration 005: Create Matches
-- =========================
-- Description: Matches at venues in final state.
--   Includes title, duration_mins, unique(venue_id, scheduled_at).
-- Dependencies: 001, 004
-- =========================

CREATE TABLE IF NOT EXISTS matches (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         UUID          NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  title            VARCHAR(500)  NOT NULL DEFAULT 'Match',
  sport_type       sport_type    NOT NULL,
  scheduled_at     TIMESTAMPTZ   NOT NULL,
  duration_mins    INT           NOT NULL DEFAULT 60,
  price_per_player NUMERIC(10, 2) NOT NULL,
  status           match_status  NOT NULL DEFAULT 'scheduled',
  max_players      INT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT matches_duration_mins_positive CHECK (duration_mins >= 1),
  CONSTRAINT matches_price_per_player_positive CHECK (price_per_player > 0)
);

CREATE INDEX IF NOT EXISTS idx_matches_venue_id     ON matches(venue_id);
CREATE INDEX IF NOT EXISTS idx_matches_scheduled_at ON matches(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_matches_status       ON matches(status);

-- One match per venue per time slot
CREATE UNIQUE INDEX IF NOT EXISTS matches_venue_scheduled_idx ON matches (venue_id, scheduled_at);
