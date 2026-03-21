BEGIN;

-- =========================
-- Migration 012: Add slug and is_active to tenants
-- =========================
-- Description: Tenant slug for subdomain lookup; is_active for soft-disable
-- Dependencies: 002
-- =========================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Backfill slug from name for existing rows (lowercase, replace spaces with hyphens)
UPDATE tenants
SET slug = lower(regexp_replace(trim(name), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Fallback for empty slug (e.g. empty name)
UPDATE tenants
SET slug = 'tenant-' || id::text
WHERE slug IS NULL OR slug = '';

-- Now enforce NOT NULL
ALTER TABLE tenants ALTER COLUMN slug SET NOT NULL;

-- Unique index for lookup
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants (slug);

COMMIT;

-- =========================
-- ROLLBACK SCRIPT (in comments)
-- =========================
/*
BEGIN;
DROP INDEX IF EXISTS tenants_slug_idx;
ALTER TABLE tenants DROP COLUMN IF EXISTS slug;
ALTER TABLE tenants DROP COLUMN IF EXISTS is_active;
COMMIT;
*/
