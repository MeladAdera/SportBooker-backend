-- =========================
-- Migration 007: Create Match Results
-- =========================
-- Description: Stores operator-submitted match outcomes and per-player stats.
--   match_results: one row per completed match (winning_side NULL = draw).
--   player_match_stats: per-player goals, assists, MVP flag for each match.
-- Dependencies: 001, 003, 005
-- =========================

-- Idempotent: 001 may already be marked applied from before match_side existed.
DO $$
BEGIN
  CREATE TYPE match_side AS ENUM ('team_a', 'team_b');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Stores the final result for a completed match (one row per match)
CREATE TABLE IF NOT EXISTS match_results (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  winning_side match_side,          -- NULL means the match ended in a draw
  submitted_by UUID        NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id)
);

COMMENT ON COLUMN match_results.winning_side IS
  'NULL indicates a draw; team_a or team_b indicates the winning side.';

CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON match_results(match_id);

-- Per-player stats for a match (goals, assists, MVP)
CREATE TABLE IF NOT EXISTS player_match_stats (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id  UUID        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_side match_side  NOT NULL,
  goals     SMALLINT    NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists   SMALLINT    NOT NULL DEFAULT 0 CHECK (assists >= 0),
  is_mvp    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_player_match_stats_match_id ON player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_user_id  ON player_match_stats(user_id);
