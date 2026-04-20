-- =========================
-- Seed 006: Fake demo players
-- =========================
-- Synthetic `users` rows (`is_fake = true`, no password) for tenant-admin
-- auto-fill (`POST .../matches/:id/auto-fill-fake`) and demos.
-- Emails use the same `fake+<uuid>@fake.local` pattern as the API.
-- Phones use 9715999… to avoid collisions with 002_seed_users.
-- Run after 002_seed_users. Idempotent: ON CONFLICT (tenant_id, email) DO NOTHING.
-- =========================

INSERT INTO users (
  tenant_id,
  name,
  email,
  password_hash,
  phone,
  photo_url,
  role,
  is_fake,
  email_verified_at,
  skill_level,
  preferred_position,
  dominant_foot,
  preferred_days,
  created_at,
  updated_at
)
SELECT t.id, v.name, v.email, NULL, v.phone, v.photo_url, 'player'::user_role, true, NULL,
  v.skill_level::skill_level,
  v.preferred_position::player_position,
  v.dominant_foot::dominant_foot,
  v.preferred_days::day_of_week[],
  now(),
  now()
FROM tenants t
JOIN (VALUES
  ('acfc', 'Demo Fake 01',  'fake+a1000000-0000-4000-8000-000000000001@fake.local', 971599910001::bigint, 'https://i.pravatar.cc/300?u=fd01', 'beginner',     'forward',    'right',  ARRAY['saturday','sunday']::text[]),
  ('acfc', 'Demo Fake 02',  'fake+a1000000-0000-4000-8000-000000000002@fake.local', 971599910002::bigint, 'https://i.pravatar.cc/300?u=fd02', 'intermediate', 'midfielder', 'left',   ARRAY['friday','saturday']::text[]),
  ('acfc', 'Demo Fake 03',  'fake+a1000000-0000-4000-8000-000000000003@fake.local', 971599910003::bigint, 'https://i.pravatar.cc/300?u=fd03', 'advanced',     'defender',   'both',   ARRAY['wednesday','thursday']::text[]),
  ('acfc', 'Demo Fake 04',  'fake+a1000000-0000-4000-8000-000000000004@fake.local', 971599910004::bigint, 'https://i.pravatar.cc/300?u=fd04', 'intermediate', 'goalkeeper', 'right',  ARRAY['sunday']::text[]),
  ('acfc', 'Demo Fake 05',  'fake+a1000000-0000-4000-8000-000000000005@fake.local', 971599910005::bigint, 'https://i.pravatar.cc/300?u=fd05', 'beginner',     'defender',   'left',   ARRAY['monday','wednesday']::text[]),
  ('acfc', 'Demo Fake 06',  'fake+a1000000-0000-4000-8000-000000000006@fake.local', 971599910006::bigint, 'https://i.pravatar.cc/300?u=fd06', 'advanced',     'forward',    'right',  ARRAY['tuesday','saturday']::text[]),
  ('acfc', 'Demo Fake 07',  'fake+a1000000-0000-4000-8000-000000000007@fake.local', 971599910007::bigint, 'https://i.pravatar.cc/300?u=fd07', 'intermediate', 'midfielder', 'both',   ARRAY['thursday','friday','saturday']::text[]),
  ('acfc', 'Demo Fake 08',  'fake+a1000000-0000-4000-8000-000000000008@fake.local', 971599910008::bigint, 'https://i.pravatar.cc/300?u=fd08', 'beginner',     'midfielder', 'right',  ARRAY['saturday']::text[]),
  ('acfc', 'Demo Fake 09',  'fake+a1000000-0000-4000-8000-000000000009@fake.local', 971599910009::bigint, 'https://i.pravatar.cc/300?u=fd09', 'intermediate', 'forward',    'left',   ARRAY['friday','sunday']::text[]),
  ('acfc', 'Demo Fake 10',  'fake+a1000000-0000-4000-8000-00000000000a@fake.local', 971599910010::bigint, 'https://i.pravatar.cc/300?u=fd10', 'advanced',     'defender',   'right',  ARRAY['monday','tuesday','wednesday']::text[]),
  ('acfc', 'Demo Fake 11',  'fake+a1000000-0000-4000-8000-00000000000b@fake.local', 971599910011::bigint, 'https://i.pravatar.cc/300?u=fd11', 'intermediate', 'goalkeeper', 'both',   ARRAY['saturday','sunday']::text[]),
  ('acfc', 'Demo Fake 12',  'fake+a1000000-0000-4000-8000-00000000000c@fake.local', 971599910012::bigint, 'https://i.pravatar.cc/300?u=fd12', 'beginner',     'forward',    'right',  ARRAY['thursday']::text[]),
  ('downtown', 'Demo Fake D1', 'fake+b2000000-0000-4000-8000-000000000001@fake.local', 971599920001::bigint, 'https://i.pravatar.cc/300?u=dd01', 'intermediate', 'midfielder', 'right', ARRAY['saturday']::text[]),
  ('downtown', 'Demo Fake D2', 'fake+b2000000-0000-4000-8000-000000000002@fake.local', 971599920002::bigint, 'https://i.pravatar.cc/300?u=dd02', 'advanced',     'forward',    'left',  ARRAY['friday','saturday']::text[])
) AS v(tenant_slug, name, email, phone, photo_url, skill_level, preferred_position, dominant_foot, preferred_days)
  ON t.slug = v.tenant_slug
ON CONFLICT (tenant_id, email) DO NOTHING;
