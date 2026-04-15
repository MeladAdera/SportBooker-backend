-- =========================
-- Seed 002: Users
-- =========================
-- Password for all: Password123! (bcrypt, 12 rounds)
-- platform_admin lives in the 'platform' system tenant (is_active=false so it never resolves via subdomain).
-- super_admin is now tenant-scoped — one per tenant, created alongside the tenant.
-- Run after 001_seed_tenants. Idempotent: ON CONFLICT DO NOTHING.
-- phone: BIGINT E.164 digits without + (placeholder values for seeds).
-- =========================

INSERT INTO users (tenant_id, name, email, password_hash, phone, photo_url, role, created_at, updated_at)
SELECT t.id, v.name, v.email, v.password_hash, v.phone, '', v.role::user_role, now(), now()
FROM (VALUES
  ('platform', 'Platform Admin', 'platform-admin@platform.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000000::bigint, 'platform_admin'),
  ('acfc', 'Super Admin', 'super-admin@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000001::bigint, 'super_admin'),
  ('acfc', 'Admin', 'admin@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000002::bigint, 'tenant_admin'),
  ('acfc', 'Staff', 'staff@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000003::bigint, 'tenant_staff'),
  ('acfc', 'Player', 'player@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000004::bigint, 'player'),
  ('downtown', 'Super Admin', 'super-admin@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000005::bigint, 'super_admin'),
  ('downtown', 'Admin', 'admin@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000006::bigint, 'tenant_admin'),
  ('downtown', 'Staff', 'staff@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000007::bigint, 'tenant_staff'),
  ('downtown', 'Player', 'player@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 971500000008::bigint, 'player')
) AS v(tenant_slug, name, email, password_hash, phone, role)
JOIN tenants t ON t.slug = v.tenant_slug
ON CONFLICT (tenant_id, email) DO NOTHING;
