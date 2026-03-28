-- =========================
-- Migration 023: Venues — require address and maps_url
-- =========================

UPDATE venues
SET address = 'Address not set'
WHERE address IS NULL;

UPDATE venues
SET maps_url = 'https://maps.example.com/'
WHERE maps_url IS NULL;

ALTER TABLE venues ALTER COLUMN address SET NOT NULL;
ALTER TABLE venues ALTER COLUMN maps_url SET NOT NULL;
