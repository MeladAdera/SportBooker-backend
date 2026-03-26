-- =========================
-- Migration 019: Tenant logo, cancel cutoff, slug length, default timezone
-- =========================
-- Description: Optional logo URL; booking cancel window in hours; slug max 100; new rows default TZ Asia/Dubai
-- Dependencies: 012, 013
-- =========================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cancel_cutoff_hours INTEGER NOT NULL DEFAULT 24;

ALTER TABLE tenants ALTER COLUMN timezone SET DEFAULT 'Asia/Dubai';

ALTER TABLE tenants ALTER COLUMN slug TYPE VARCHAR(100);
