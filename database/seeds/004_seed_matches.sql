-- =========================
-- Seed 004: Matches
-- =========================
-- Upcoming, ongoing, and completed matches across venues
-- Run after 003_seed_venues. Idempotent: ON CONFLICT DO NOTHING.
-- =========================

INSERT INTO matches (venue_id, sport_type, scheduled_at, price_per_player, status, max_players, created_at, updated_at)
SELECT v.id, m.sport_type::sport_type, m.scheduled_at, m.price_per_player, m.status::match_status, m.max_players, now(), now()
FROM (VALUES
  ('acfc', 'ACFC Main Pitch', 'football', now() - interval '2 days', 15.00, 'completed', 22),
  ('acfc', 'ACFC Tennis Courts', 'tennis', now() - interval '1 day', 25.00, 'completed', 4),
  ('acfc', 'ACFC Main Pitch', 'football', now() - interval '1 hour', 15.00, 'in_progress', 22),
  ('acfc', 'ACFC Main Pitch', 'football', now() + interval '2 days', 15.00, 'scheduled', 22),
  ('acfc', 'ACFC Basketball Hall', 'basketball', now() + interval '3 days', 12.00, 'scheduled', 10),
  ('acfc', 'ACFC Tennis Courts', 'tennis', now() + interval '1 day', 25.00, 'scheduled', 4),
  ('downtown', 'Downtown Football Arena', 'football', now() + interval '5 days', 20.00, 'scheduled', 22),
  ('downtown', 'Downtown Volleyball Beach', 'volleyball', now() + interval '7 days', 10.00, 'scheduled', 12)
) AS m(tenant_slug, venue_name, sport_type, scheduled_at, price_per_player, status, max_players)
JOIN tenants t ON t.slug = m.tenant_slug
JOIN venues v ON v.tenant_id = t.id AND v.name = m.venue_name
ON CONFLICT (venue_id, scheduled_at) DO NOTHING;
