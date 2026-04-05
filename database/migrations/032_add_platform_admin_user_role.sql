-- =========================
-- Migration 032: platform_admin user_role value
-- =========================
-- For databases that ran 013 before platform_admin was added to that file.
-- =========================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_admin';
