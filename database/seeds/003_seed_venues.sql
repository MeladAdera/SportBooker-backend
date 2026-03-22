-- =========================
-- Seed 003: Venues
-- =========================
-- 2+ venues per tenant with varying sport types (matches at venues have sport_type)
-- Run after 001_seed_tenants. Idempotent: ON CONFLICT DO NOTHING.
-- =========================

INSERT INTO venues (tenant_id, name, address, created_at, updated_at)
SELECT t.id, v.name, v.address, now(), now()
FROM (VALUES
  ('acfc', 'ACFC Main Pitch', '1 Stadium Road, London'),
  ('acfc', 'ACFC Tennis Courts', '2 Stadium Road, London'),
  ('acfc', 'ACFC Basketball Hall', '3 Stadium Road, London'),
  ('downtown', 'Downtown Football Arena', '100 Main St, New York'),
  ('downtown', 'Downtown Volleyball Beach', '101 Main St, New York')
) AS v(tenant_slug, name, address)
JOIN tenants t ON t.slug = v.tenant_slug
ON CONFLICT (tenant_id, name) DO NOTHING;
