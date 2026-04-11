-- =========================
-- Migration 024: Matches — title, duration_mins, sport_type enum values
-- =========================
-- sport_type: padel, cricket, generic (venue tags already used these as TEXT[])
-- =========================

DO $$
BEGIN
  ALTER TYPE sport_type ADD VALUE 'padel';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE sport_type ADD VALUE 'cricket';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE sport_type ADD VALUE 'generic';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS title VARCHAR(500) NOT NULL DEFAULT 'Match';

ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration_mins INT NOT NULL DEFAULT 60;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_duration_mins_positive;
ALTER TABLE matches ADD CONSTRAINT matches_duration_mins_positive CHECK (duration_mins >= 1);
