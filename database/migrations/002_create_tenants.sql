-- =========================
-- Migration 002: Create Tenants
-- =========================
-- Description: Multi-tenant root table in final state.
--   Includes slug, is_active, timezone, logo_url,
--   cancel_cutoff_hours, and Ziina payment credentials.
-- Dependencies: none
-- =========================

CREATE TABLE IF NOT EXISTS tenants (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(255)  NOT NULL,
  slug                  VARCHAR(100)  NOT NULL,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  timezone              VARCHAR(50)   NOT NULL DEFAULT 'Asia/Dubai',
  logo_url              TEXT,
  cancel_cutoff_hours   INTEGER       NOT NULL DEFAULT 24,
  ziina_access_token    TEXT,
  ziina_webhook_secret  TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants (slug);
