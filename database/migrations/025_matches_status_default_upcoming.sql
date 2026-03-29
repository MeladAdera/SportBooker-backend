-- =========================
-- Migration 025: Default match status = upcoming
-- =========================
-- Must run in a separate migration from enum ADD VALUE (024) so the new label is committed first.
-- =========================

ALTER TABLE matches ALTER COLUMN status SET DEFAULT 'upcoming';
