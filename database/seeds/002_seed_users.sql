-- =========================
-- Seed 002: Users
-- =========================
-- One user per role (super_admin, tenant_admin, tenant_staff, player) per tenant.
-- Password for all: Password123! (bcrypt, 12 rounds)
-- Run after 001_seed_tenants. Idempotent: ON CONFLICT DO NOTHING.
-- =========================

INSERT INTO users (tenant_id, email, password_hash, role, created_at, updated_at)
SELECT t.id, v.email, v.password_hash, v.role::user_role, now(), now()
FROM (VALUES
  ('acfc', 'super-admin@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'super_admin'),
  ('acfc', 'admin@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'tenant_admin'),
  ('acfc', 'staff@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'tenant_staff'),
  ('acfc', 'player@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'player'),
  ('downtown', 'super-admin@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'super_admin'),
  ('downtown', 'admin@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'tenant_admin'),
  ('downtown', 'staff@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'tenant_staff'),
  ('downtown', 'player@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'player')
) AS v(tenant_slug, email, password_hash, role)
JOIN tenants t ON t.slug = v.tenant_slug
ON CONFLICT (tenant_id, email) DO NOTHING;
