-- =========================
-- Migration 004: Create Venues
-- =========================
-- Description: Venues per tenant in final state.
--   Includes address, maps_url, picture_url, sport_types (GIN indexed),
--   is_active, unique name per tenant.
-- Dependencies: 001, 002
-- =========================

CREATE TABLE IF NOT EXISTS venues (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255)  NOT NULL,
  address     TEXT          NOT NULL,
  maps_url    TEXT          NOT NULL,
  picture_url VARCHAR(2048),
  sport_types TEXT[]        NOT NULL,
  is_active   BOOLEAN       NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT venues_sport_types_not_empty CHECK (cardinality(sport_types) >= 1),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_venues_tenant_id       ON venues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_venues_sport_types_gin ON venues USING GIN (sport_types);
