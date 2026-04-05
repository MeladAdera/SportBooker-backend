-- =========================
-- Seed 001: Tenants
-- =========================
-- 'platform' is the system tenant that owns the platform_admin user.
-- 'acfc' and 'downtown' are regular sport club tenants.
-- Run after migrations. Idempotent: ON CONFLICT (slug) DO UPDATE.
-- =========================

INSERT INTO tenants (id, name, slug, is_active, timezone, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Platform (System)', 'platform', true, 'UTC', now(), now()),
  (gen_random_uuid(), 'ACFC Sports', 'acfc', true, 'Europe/London', now(), now()),
  (gen_random_uuid(), 'Downtown Arena', 'downtown', true, 'America/New_York', now(), now())
ON CONFLICT (slug) DO UPDATE SET
  timezone = EXCLUDED.timezone,
  is_active = EXCLUDED.is_active,
  updated_at = now();
