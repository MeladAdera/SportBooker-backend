-- =========================
-- Migration 008: Create Reviews
-- =========================
-- Description: User reviews for matches, UNIQUE(match_id, user_id)
-- Dependencies: 003, 005
-- =========================

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_match_id ON reviews(match_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

-- =========================
-- ROLLBACK SCRIPT (in comments)
-- =========================
/*
BEGIN;
DROP TABLE IF EXISTS reviews;
COMMIT;
*/
