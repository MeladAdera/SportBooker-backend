-- =========================
-- Migration 014: Unique venue name per tenant
-- =========================
-- For idempotent venue seeds: (tenant_id, name) unique
-- =========================

CREATE UNIQUE INDEX IF NOT EXISTS venues_tenant_id_name_idx ON venues (tenant_id, name);
