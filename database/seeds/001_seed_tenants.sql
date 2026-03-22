-- =========================
-- Seed 001: Tenants
-- =========================
-- 2 tenants with different slugs and timezones
-- Run after migrations. Idempotent: ON CONFLICT DO NOTHING.
-- =========================

INSERT INTO tenants (id, name, slug, is_active, timezone, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'ACFC Sports', 'acfc', true, 'Europe/London', now(), now()),
  (gen_random_uuid(), 'Downtown Arena', 'downtown', true, 'America/New_York', now(), now())
ON CONFLICT (slug) DO UPDATE SET timezone = EXCLUDED.timezone, updated_at = now();
