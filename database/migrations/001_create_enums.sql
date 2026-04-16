-- =========================
-- Migration 001: Create Enums
-- =========================
-- Description: All application enums in final state.
--   user_role, sport_type, match_status, booking_status,
--   booking_position, wallet_tx_type, payment_intent_status,
--   notification_type, notification_channel,
--   skill_level, player_position, dominant_foot, match_side
-- Dependencies: none
-- =========================

-- User roles
DO $$
BEGIN
  CREATE TYPE user_role AS ENUM (
    'platform_admin',
    'super_admin',
    'tenant_admin',
    'tenant_staff',
    'player'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Sport types
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

-- Match status: only 'scheduled' and 'cancelled' are stored.
-- 'upcoming', 'in_progress', 'completed' are computed at query time
-- from scheduled_at + duration_mins.
DO $$
BEGIN
  CREATE TYPE match_status AS ENUM ('scheduled', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Booking status
DO $$
BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Booking position (field vs goalkeeper)
DO $$
BEGIN
  CREATE TYPE booking_position AS ENUM ('field_player', 'goalkeeper');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Wallet transaction types
DO $$
BEGIN
  CREATE TYPE wallet_tx_type AS ENUM ('credit', 'debit', 'refund', 'topup');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Payment intent status (Ziina top-up lifecycle)
DO $$
BEGIN
  CREATE TYPE payment_intent_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Notification types
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

-- Notification delivery channels
DO $$
BEGIN
  CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'push');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Player skill level
DO $$
BEGIN
  CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Player preferred position (football-style)
DO $$
BEGIN
  CREATE TYPE player_position AS ENUM ('goalkeeper', 'defender', 'midfielder', 'forward');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Player dominant foot
DO $$
BEGIN
  CREATE TYPE dominant_foot AS ENUM ('left', 'right', 'both');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Match team side for match results
DO $$
BEGIN
  CREATE TYPE match_side AS ENUM ('team_a', 'team_b');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
