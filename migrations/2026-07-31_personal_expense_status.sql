-- ============================================================================
-- Personal Expense Status (paid | pending)
--
-- Adds a settlement-free "is this actually paid yet?" flag to personal (book)
-- expenses so a solo user can log an upcoming/unpaid bill and mark it Paid once
-- settled. Existing rows are money already spent, so they backfill to 'paid';
-- new rows also default to 'paid' (the app lets the user flip to 'pending').
--
-- The app reports Paid vs Pending totals split out (Total Spent card, Stats,
-- home Overview) — this is purely a client concern; the DB just stores the flag.
-- No RLS/trigger changes: the existing owner policy already governs the column.
--
-- ----------------------------------------------------------------------------
-- DEV / PROD — environments split by Postgres schema in ONE Supabase project
-- (`public` = prod, `dev` = isolated). Apply to BOTH. Identifiers are UNQUALIFIED
-- and resolved via the SET below, so you pick the target purely by that one line.
--
-- >>> ROLLOUT ORDER (dev first, prod at release): <<<
--   * NOW — apply to DEV:        keep `SET search_path = dev, public, extensions;`
--   * AT RELEASE — apply to PROD: change it to `SET search_path = public, extensions;`
--
-- Every statement is guarded (IF NOT EXISTS / scoped to current_schema()), so
-- it's safe to run more than once and against either schema.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- status — 'paid' (default) | 'pending'. NOT NULL with a default so existing
-- rows backfill to 'paid' and the offline-created rows (which omit it) stay
-- valid.
-- ---------------------------------------------------------------------
ALTER TABLE personal_expenses_tbl
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'paid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_expenses_status_chk'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE personal_expenses_tbl
      ADD CONSTRAINT personal_expenses_status_chk
      CHECK (status IN ('paid', 'pending'));
  END IF;
END $$;
