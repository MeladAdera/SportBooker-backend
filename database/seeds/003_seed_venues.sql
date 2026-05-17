-- =========================
-- Seed 003: Venues
-- =========================
-- 2+ venues per tenant with varying sport types (matches at venues have sport_type)
-- Run after 001_seed_tenants. Idempotent: ON CONFLICT DO NOTHING.
-- =========================

INSERT INTO venues (
  tenant_id,
  name,
  address,
  maps_url,
  picture_url,
  sport_types,
  is_active,
  created_at,
  updated_at
)
SELECT
  t.id,
  v.name,
  v.address,
  v.maps_url,
  v.picture_url,
  v.sport_types,
  true,
  now(),
  now()
FROM (VALUES
  (
    'acfc',
    'ACFC Main Pitch',
    '1 Stadium Road, London',
    'https://maps.example.com/acfc-main',
    'https://cdn.example.com/venues/acfc-main.jpg',
    ARRAY['football', 'tennis']::TEXT[]
  ),
  (
    'acfc',
    'ACFC Tennis Courts',
    '2 Stadium Road, London',
    'https://maps.example.com/acfc-tennis',
    NULL,
    ARRAY['basketball', 'volleyball']::TEXT[]
  ),
  (
    'acfc',
    'ACFC Basketball Hall',
    '3 Stadium Road, London',
    'https://maps.example.com/acfc-hall',
    NULL,
    ARRAY['generic']::TEXT[]
  ),
  (
    'downtown',
    'Downtown Football Arena',
    '100 Main St, New York',
    'https://maps.example.com/downtown-football',
    NULL,
    ARRAY['football']::TEXT[]
  ),
  (
    'downtown',
    'Downtown Volleyball Beach',
    '101 Main St, New York',
    'https://maps.example.com/downtown-beach',
    NULL,
    ARRAY['football', 'generic']::TEXT[]
  )
) AS v(tenant_slug, name, address, maps_url, picture_url, sport_types)
JOIN tenants t ON t.slug = v.tenant_slug
ON CONFLICT (tenant_id, name) DO NOTHING;
