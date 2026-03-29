-- =========================
-- Seed 004: Matches
-- =========================
-- Upcoming, ongoing, and completed matches across venues
-- Run after 003_seed_venues. Idempotent: ON CONFLICT DO NOTHING.
-- =========================

INSERT INTO matches (venue_id, title, sport_type, scheduled_at, duration_mins, price_per_player, status, max_players, created_at, updated_at)
SELECT v.id, m.title, m.sport_type::sport_type, m.scheduled_at, m.duration_mins, m.price_per_player, m.status::match_status, m.max_players, now(), now()
FROM (VALUES
  ('acfc', 'ACFC Main Pitch', 'Past game', 'football', now() - interval '2 days', 90, 15.00, 'completed', 22),
  ('acfc', 'ACFC Tennis Courts', 'Tennis done', 'tennis', now() - interval '1 day', 60, 25.00, 'completed', 4),
  ('acfc', 'ACFC Main Pitch', 'Live now', 'football', now() - interval '1 hour', 90, 15.00, 'in_progress', 22),
  ('acfc', 'ACFC Main Pitch', 'Weekend kickoff', 'football', now() + interval '2 days', 90, 15.00, 'upcoming', 22),
  ('acfc', 'ACFC Basketball Hall', 'Hoops night', 'basketball', now() + interval '3 days', 60, 12.00, 'upcoming', 10),
  ('acfc', 'ACFC Tennis Courts', 'Tennis open', 'tennis', now() + interval '1 day', 60, 25.00, 'upcoming', 4),
  ('downtown', 'Downtown Football Arena', 'City league', 'football', now() + interval '5 days', 90, 20.00, 'upcoming', 22),
  ('downtown', 'Downtown Volleyball Beach', 'Beach cup', 'volleyball', now() + interval '7 days', 90, 10.00, 'upcoming', 12)
) AS m(tenant_slug, venue_name, title, sport_type, scheduled_at, duration_mins, price_per_player, status, max_players)
JOIN tenants t ON t.slug = m.tenant_slug
JOIN venues v ON v.tenant_id = t.id AND v.name = m.venue_name
ON CONFLICT (venue_id, scheduled_at) DO NOTHING;
