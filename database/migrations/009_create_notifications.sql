-- =========================
-- Migration 009: Create Notifications
-- =========================
-- Description: User notifications with type and channel
-- Dependencies: 001, 003
-- =========================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);

-- =========================
-- ROLLBACK SCRIPT (in comments)
-- =========================
/*
BEGIN;
DROP TABLE IF EXISTS notifications;
COMMIT;
*/
