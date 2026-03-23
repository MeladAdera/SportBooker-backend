-- =========================
-- Migration 017: Add user is_active
-- =========================
-- Description: Allow deactivating users (login rejected when false)
-- Dependencies: 003
-- =========================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
