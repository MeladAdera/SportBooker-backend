-- =========================
-- Migration 024: Matches — title, duration_mins, sport_type / match_status enum values
-- =========================
-- sport_type: padel, cricket, generic (venue tags already used these as TEXT[])
-- match_status: upcoming (new matches per product)
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

DO $$
BEGIN
  ALTER TYPE match_status ADD VALUE 'upcoming';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS title VARCHAR(500) NOT NULL DEFAULT 'Match';

ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration_mins INT NOT NULL DEFAULT 60;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_duration_mins_positive;
ALTER TABLE matches ADD CONSTRAINT matches_duration_mins_positive CHECK (duration_mins >= 1);

-- Do not SET DEFAULT 'upcoming' here: PG forbids using a new enum label in the same
-- transaction as ALTER TYPE ADD VALUE (55P04). See 025_matches_status_default_upcoming.sql.
