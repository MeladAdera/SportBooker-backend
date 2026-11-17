-- =========================
-- Seed 007: Demo media + 100-day match schedule
-- =========================
-- For the public demo:
--   1. Venue pictures (files live in the frontend: public/demo/venues/*.jpg)
--   2. Two extra football venues for ACFC
--   3. Generated cartoon avatars (DiceBear) for seeded players that have no
--      photo or still use the old placeholder. Real uploads are left alone.
--   4. Matches for the next 100 days on every seeded venue
--
-- Idempotent: safe to run again.
--   - Venue pictures / avatars are UPDATEs.
--   - Match times are anchored to midnight UTC of the run day + whole days +
--     fixed hours, so the same calendar slot always has the same scheduled_at
--     and ON CONFLICT (venue_id, scheduled_at) skips it. Running it on a later
--     day only adds the new days at the end of the window.
--
-- Run after 001-006. Apply alone with:
--   psql "$DATABASE_URL" -f database/seeds/007_seed_demo_media_and_schedule.sql
-- =========================

-- Public origin of the frontend that serves /demo/venues/*.jpg.
-- Absolute URLs are required: venue forms validate pictureUrl as a URL.
CREATE TEMP TABLE IF NOT EXISTS _demo_cfg (web_origin TEXT NOT NULL);
TRUNCATE _demo_cfg;
INSERT INTO _demo_cfg VALUES ('https://sport-booker-frontend.vercel.app');

-- -------------------------------------------------------
-- 1 + 2. Venues: extra football venues, then pictures
-- -------------------------------------------------------
INSERT INTO venues (tenant_id, name, address, maps_url, picture_url, sport_types, is_active, created_at, updated_at)
SELECT t.id, v.name, v.address, v.maps_url, NULL, v.sport_types, true, now(), now()
FROM (VALUES
  ('acfc', 'ACFC Five-a-Side Court', '3 Stadium Road, London', 'https://maps.example.com/acfc-five', ARRAY['football']::TEXT[]),
  ('acfc', 'ACFC Indoor Arena',      '5 Stadium Road, London', 'https://maps.example.com/acfc-indoor', ARRAY['football']::TEXT[])
) AS v(tenant_slug, name, address, maps_url, sport_types)
JOIN tenants t ON t.slug = v.tenant_slug
ON CONFLICT (tenant_id, name) DO NOTHING;

UPDATE venues ve
SET picture_url = c.web_origin || '/demo/venues/' || p.file,
    updated_at  = now()
FROM (VALUES
  ('acfc',     'ACFC Main Pitch',         'stadium.jpg'),
  ('acfc',     'ACFC Five-a-Side Court',  'striped-turf.jpg'),
  ('acfc',     'ACFC Indoor Arena',       'indoor-arena.jpg'),
  ('downtown', 'Downtown Football Arena', 'night-pitch.jpg')
) AS p(tenant_slug, venue_name, file)
JOIN tenants t ON t.slug = p.tenant_slug
CROSS JOIN _demo_cfg c
WHERE ve.tenant_id = t.id AND ve.name = p.venue_name;

-- -------------------------------------------------------
-- 3. Player avatars (generated illustrations, not real people)
-- -------------------------------------------------------
UPDATE users u
SET photo_url  = 'https://api.dicebear.com/9.x/avataaars/svg?seed=' || md5(u.email),
    updated_at = now()
FROM tenants t
WHERE u.tenant_id = t.id
  AND t.slug IN ('acfc', 'downtown')
  AND (u.photo_url IS NULL OR u.photo_url = '' OR u.photo_url LIKE '%assets.manutd.com%');

-- -------------------------------------------------------
-- 4. Matches for the next 100 days
-- -------------------------------------------------------
-- every_n / offset: a match on day d when (d + offset) % every_n = 0.
-- hour_utc: kick-off hour (UTC). Titles rotate per occurrence.
INSERT INTO matches (venue_id, title, sport_type, scheduled_at, duration_mins, price_per_player, status, max_players, created_at, updated_at)
SELECT
  v.id,
  s.titles[1 + ((d / s.every_n) % array_length(s.titles, 1))],
  s.sport_type::sport_type,
  date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    + d * interval '1 day' + s.hour_utc * interval '1 hour',
  s.duration_mins,
  s.price,
  'scheduled'::match_status,
  s.max_players,
  now(),
  now()
FROM (VALUES
  ('acfc',     'ACFC Main Pitch',          'football',   2, 0, 19, 90, 15.00, 22,
     ARRAY['Evening Football 11v11', 'Weekend League', 'Friendly Match', 'Champions Night']),
  ('acfc',     'ACFC Five-a-Side Court',   'football',   2, 1, 20, 60,  8.00, 10,
     ARRAY['Five-a-Side Fixture', 'After-Work 5v5', 'Quick Kickabout']),
  ('acfc',     'ACFC Indoor Arena',        'football',   3, 0, 18, 60, 10.00, 12,
     ARRAY['Indoor 6v6', 'Futsal Night', 'Indoor Cup Round']),
  ('acfc',     'ACFC Basketball Hall',     'basketball', 7, 2, 19, 60, 12.00, 10,
     ARRAY['Hoops Night 5v5', 'Basketball Pickup Game']),
  ('acfc',     'ACFC Tennis Courts',       'tennis',     4, 1, 17, 60, 25.00,  4,
     ARRAY['Padel Doubles', 'Tennis Singles Ladder']),
  ('downtown', 'Downtown Football Arena',  'football',   3, 1, 20, 90, 20.00, 22,
     ARRAY['City League Matchday', 'Downtown Derby', 'Night Football']),
  ('downtown', 'Downtown Volleyball Beach','volleyball', 7, 4, 16, 90, 10.00, 12,
     ARRAY['Beach Volleyball Cup', 'Sunset Volleyball'])
) AS s(tenant_slug, venue_name, sport_type, every_n, offset_days, hour_utc, duration_mins, price, max_players, titles)
JOIN tenants t ON t.slug = s.tenant_slug
JOIN venues v ON v.tenant_id = t.id AND v.name = s.venue_name
CROSS JOIN generate_series(1, 100) AS d
WHERE (d + s.offset_days) % s.every_n = 0
ON CONFLICT (venue_id, scheduled_at) DO NOTHING;

DROP TABLE IF EXISTS _demo_cfg;
