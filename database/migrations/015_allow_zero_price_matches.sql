-- =========================
-- Migration 015: Allow Zero Price Matches
-- =========================
-- Description: Modify price constraint to allow free matches (price >= 0)
-- Dependencies: 005
-- =========================

ALTER TABLE matches
DROP CONSTRAINT matches_price_per_player_postive,
ADD CONSTRAINT matches_price_per_player_non_negative CHECK (price_per_player >= 0);
