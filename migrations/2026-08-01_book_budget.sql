-- ============================================================================
-- Per-book budgets — wiring up the forward-compat `budget` column.
--
-- personal_books_tbl.budget (numeric, nullable) already exists from
-- 2026-07-28_personal_books_v1.sql, where it was reserved as "design-for, not
-- built". This migration makes it real by adding the one thing it was missing:
-- a PERIOD. Books come in two shapes and a single fixed period serves only one
-- of them —
--   * 'monthly' → a recurring cap that resets each calendar month ("Daily",
--                 "Groceries"). This is the default, matching how the column
--                 was originally documented.
--   * 'total'   → a single lifetime cap for the whole book ("Japan Trip"),
--                 where a mid-trip monthly reset would be the wrong model.
--
-- budget stays nullable: NULL = no budget set, and budget_period is simply
-- ignored in that case. Budgets are free for all users (no plan gate) — the
-- free tier is already metered by the 5/day personal expense limit.
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
-- NOTE: prod has not yet had 2026-07-28_personal_books_v1.sql applied. Run that
-- one FIRST against prod, then this one.
--
-- Every statement is guarded (IF NOT EXISTS / DO-block constraint check), so
-- this is safe to run more than once and against either schema.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- 1. budget_period — how the `budget` cap is measured.
-- ---------------------------------------------------------------------
-- NOT NULL + default keeps every existing row (all of which have budget IS
-- NULL) on the historical 'monthly' meaning, so no backfill is needed.
ALTER TABLE personal_books_tbl
  ADD COLUMN IF NOT EXISTS budget_period text NOT NULL DEFAULT 'monthly';

-- Guarded so a re-run doesn't fail on the duplicate constraint name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_books_budget_period_chk'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE personal_books_tbl
      ADD CONSTRAINT personal_books_budget_period_chk
      CHECK (budget_period IN ('monthly', 'total'));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. A budget must be a positive amount when set.
--
-- Zero is rejected rather than treated as "no budget" — NULL is the one and
-- only way to express that, so the UI never has to disambiguate the two.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_books_budget_positive_chk'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE personal_books_tbl
      ADD CONSTRAINT personal_books_budget_positive_chk
      CHECK (budget IS NULL OR budget > 0);
  END IF;
END $$;

-- No RLS/grant changes: budget and budget_period live on personal_books_tbl,
-- which is already owner-only via the "personal_books_owner" policy.

-- ---------------------------------------------------------------------
-- 3. Reload PostgREST's schema cache.
--
-- PostgREST caches the table's columns and rejects writes naming anything it
-- hasn't seen with PGRST204 ("Could not find the 'budget_period' column ... in
-- the schema cache"). Supabase picks DDL up on its own, but not instantly —
-- this makes the new column usable the moment the migration finishes instead
-- of after an indeterminate lag.
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
