-- =========================
-- Migration 015: Allow Zero Price Matches
-- =========================
-- Description: Modify price constraint to allow free matches (price >= 0)
-- Dependencies: 005
-- =========================

DO $$
BEGIN
  BEGIN
    ALTER TABLE matches DROP CONSTRAINT matches_price_per_player_positive;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER TABLE matches DROP CONSTRAINT matches_price_per_player_non_negative;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

ALTER TABLE matches ADD CONSTRAINT matches_price_per_player_non_negative CHECK (price_per_player >= 0);
