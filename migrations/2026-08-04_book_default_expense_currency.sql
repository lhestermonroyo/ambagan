-- ============================================================================
-- Books — splitting the book's ONE currency into its two real jobs.
--
-- personal_books_tbl.currency has been doing double duty since v1:
--   1. REPORTING — the budget cap is set in it, and the budget bar, Paid/Pending
--      card, Stats gauge and group roll-up all convert INTO it.
--   2. ENTRY — it seeds the currency picker in Add Expense.
--
-- Those two want different answers on a travel book: a Japan Trip is budgeted
-- and reported in PHP (the currency the owner actually thinks in), but almost
-- every expense on it is entered in JPY. One column can serve one of those, not
-- both, so entering a trip meant re-picking JPY on every single expense.
--
-- This adds `default_expense_currency` to carry job 2 alone. `currency` keeps
-- job 1 unchanged — every existing surface that converts into it is untouched.
--
-- NULL is the default and means "same as the book's currency", which is exactly
-- the pre-migration behavior. No backfill: every existing row stays on it, and
-- the single-currency user (the overwhelming majority) never sets it.
--
-- Deliberately NOT a scope/mode flag ("this currency applies to the budget
-- only"): every surface has to render in SOME currency, so a switch that turns
-- one off leaves the other undefined. Two always-defined columns can express
-- every combination; a 3-way selector can't.
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
-- NOTE: prod has not yet had 2026-07-28_personal_books_v1.sql or
-- 2026-08-01_book_budget.sql applied. Run those FIRST against prod, in date
-- order, then this one.
--
-- Every statement is guarded (IF NOT EXISTS / DO-block constraint check), so
-- this is safe to run more than once and against either schema.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- 1. default_expense_currency — what Add Expense prefills, and nothing else.
-- ---------------------------------------------------------------------
-- Nullable with NO default: NULL is a meaningful value here ("follow the book's
-- currency"), not a missing one. Adding a default of the book's currency would
-- freeze a copy that then drifts when the book's currency is edited.
ALTER TABLE personal_books_tbl
  ADD COLUMN IF NOT EXISTS default_expense_currency text;

-- ---------------------------------------------------------------------
-- 2. Keep it a real currency code when set.
--
-- The app only ever writes a code from utils/constants `currencies`, but the
-- column is free text, so a shape check keeps a bad client (or a manual fix-up)
-- from writing something the FX table can never resolve. Deliberately a shape
-- check and not an enum of the supported list — adding a currency to the app
-- shouldn't need a migration.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_books_default_expense_currency_chk'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE personal_books_tbl
      ADD CONSTRAINT personal_books_default_expense_currency_chk
      CHECK (
        default_expense_currency IS NULL
        OR default_expense_currency ~ '^[A-Z]{3}$'
      );
  END IF;
END $$;

-- No RLS/grant changes: the column lives on personal_books_tbl, which is
-- already owner-only via the "personal_books_owner" policy.

-- ---------------------------------------------------------------------
-- 3. Reload PostgREST's schema cache.
--
-- PostgREST caches the table's columns and rejects writes naming anything it
-- hasn't seen with PGRST204 ("Could not find the 'default_expense_currency'
-- column ... in the schema cache"). Supabase picks DDL up on its own, but not
-- instantly — this makes the new column usable the moment the migration
-- finishes instead of after an indeterminate lag.
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
