-- =========================
-- Seed 002: Users
-- =========================
-- One user per role (super_admin, tenant_admin, tenant_staff, player) per tenant.
-- Password for all: Password123! (bcrypt, 12 rounds)
-- Run after 001_seed_tenants. Idempotent: ON CONFLICT DO NOTHING.
-- =========================

INSERT INTO users (tenant_id, name, email, password_hash, role, created_at, updated_at)
SELECT t.id, v.name, v.email, v.password_hash, v.role::user_role, now(), now()
FROM (VALUES
  ('acfc', 'Super Admin', 'super-admin@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'super_admin'),
  ('acfc', 'Admin', 'admin@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'tenant_admin'),
  ('acfc', 'Staff', 'staff@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'tenant_staff'),
  ('acfc', 'Player', 'player@acfc.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'player'),
  ('downtown', 'Super Admin', 'super-admin@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'super_admin'),
  ('downtown', 'Admin', 'admin@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'tenant_admin'),
  ('downtown', 'Staff', 'staff@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'tenant_staff'),
  ('downtown', 'Player', 'player@downtown.test', '$2b$12$EslEQT6WyVdhbRScuuPJ5eh0d6e8X5TFSPvYn57RSUhZgXVv0cJwm', 'player')
) AS v(tenant_slug, name, email, password_hash, role)
JOIN tenants t ON t.slug = v.tenant_slug
ON CONFLICT (tenant_id, email) DO NOTHING;
