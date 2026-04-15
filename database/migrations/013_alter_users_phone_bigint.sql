-- =========================
-- Migration 013: users.phone → BIGINT (if still VARCHAR)
-- =========================
-- Safe when 003 was applied before phone was BIGINT. No-op when already BIGINT.
-- =========================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'phone'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE users
      ALTER COLUMN phone TYPE BIGINT USING (
        COALESCE(
          NULLIF(regexp_replace(phone::text, '[^0-9]', '', 'g'), '')::bigint,
          0
        )
      );
    ALTER TABLE users ALTER COLUMN phone SET DEFAULT 0;
  END IF;
END $$;
