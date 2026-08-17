-- ============================================================================
-- Default hero view preference (Overview)
--
-- The Overview's purple hero is a two-page pager: the group net balance
-- ("balance") and month-to-date personal spending ("personal"). Which one a
-- user wants to land on depends entirely on how they use the app — someone who
-- only tracks their own books shouldn't have to swipe past a net balance of
-- zero on every launch.
--
--   'balance'  — group net balance / to collect / to pay. The default, and what
--                every existing user is already landing on.
--   'personal' — month-to-date personal spending, trend and budget rollup.
--
-- Defaults to 'balance' so existing users see no change until they opt in. The
-- app treats any unrecognised value as 'balance' too (see user.state.ts), so a
-- future third mode can't strand an older client on a blank page.
--
-- ----------------------------------------------------------------------------
-- DEV / PROD — environments split by Postgres schema in ONE Supabase project
-- (`public` = prod, `dev` = isolated). Apply to BOTH. Identifiers are
-- UNQUALIFIED and resolved via the SET below, so the target is picked purely by
-- that one line.
--
-- >>> ROLLOUT ORDER (dev first, prod at release): <<<
--   * NOW — apply to DEV:         keep `SET search_path = dev, public, extensions;`
--   * AT RELEASE — apply to PROD: change it to `SET search_path = public, extensions;`
--
-- Every statement is guarded, so this is safe to run more than once and against
-- either schema.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- 1. hero_view — which Overview hero page opens by default.
-- ---------------------------------------------------------------------
-- NOT NULL + default keeps every existing row on today's behaviour, so no
-- backfill is needed.
ALTER TABLE user_preferences_tbl
  ADD COLUMN IF NOT EXISTS hero_view text NOT NULL DEFAULT 'balance';

-- Guarded so a re-run doesn't fail on the duplicate constraint name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preferences_hero_view_chk'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE user_preferences_tbl
      ADD CONSTRAINT user_preferences_hero_view_chk
      CHECK (hero_view IN ('balance', 'personal'));
  END IF;
END $$;

-- PostgREST caches the schema; without this the app hits PGRST204 ("Could not
-- find the 'hero_view' column … in the schema cache") on the first preference
-- write until it catches up on its own.
NOTIFY pgrst, 'reload schema';
