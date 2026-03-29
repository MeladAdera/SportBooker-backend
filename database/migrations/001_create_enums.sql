-- =========================
-- Migration 001: Create Enums
-- =========================
-- Description: user_role, sport_type, match_status, booking_status,
--              wallet_tx_type, notification_type, notification_channel
-- Dependencies: none
-- =========================

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'user', 'venue_owner');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE sport_type AS ENUM (
    'football',
    'basketball',
    'tennis',
    'volleyball',
    'padel',
    'cricket',
    'generic',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE match_status AS ENUM (
    'scheduled',
    'upcoming',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE booking_status AS ENUM (
    'pending',
    'confirmed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE wallet_tx_type AS ENUM ('credit', 'debit', 'refund');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE notification_type AS ENUM (
    'booking',
    'reminder',
    'match_update',
    'wallet'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'push');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- =========================
-- ROLLBACK SCRIPT (in comments)
-- =========================
/*
BEGIN;
DROP TYPE IF EXISTS notification_channel;
DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS wallet_tx_type;
DROP TYPE IF EXISTS booking_status;
DROP TYPE IF EXISTS match_status;
DROP TYPE IF EXISTS sport_type;
DROP TYPE IF EXISTS user_role;
COMMIT;
*/
