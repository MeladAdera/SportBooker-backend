-- =========================
-- Migration 013: Tenant timezone + user roles
-- =========================
-- Description: timezone for tenants; extend user_role for super_admin, tenant_admin, tenant_staff, player
-- Dependencies: 001, 002, 003
-- =========================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'tenant_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'tenant_staff';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'player';
