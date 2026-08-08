-- ============================================================================
-- Personal Recurring Expenses (Pro) — activate the forward-compat table
--
-- personal_recurring_tbl + its owner RLS already shipped (design-for, not built)
-- in 2026-07-28_personal_books_v1.sql. This migration turns it on: it adds the
-- generator's supporting objects so the run-recurring Edge Function — the SAME
-- pg_cron job that materializes GROUP recurring expenses — can also post
-- personal (book) occurrences. No new cron job is needed; the function processes
-- both template kinds in one invocation.
--
-- What it adds:
--   * personal_recurring due-scan + book lookup indexes.
--   * updated_at touch trigger (pause/resume/amount edits stay fresh).
--   * personal_expenses_tbl (recurring_id, expense_date) unique index — the
--     double-post backstop, mirroring expenses_recurring_period_uidx. The
--     generator uses a deterministic per-period runAt, so two overlapping cron
--     runs collide here instead of materializing a period twice. A plain column
--     index (no ::date cast) keeps the expression IMMUTABLE.
--
-- No table/RLS DDL here — those already exist. Personal recurring is Pro-gated
-- entirely in the app + the generator (via users_tbl.plan); there is no DB-level
-- Pro constraint, matching the group recurring design.
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
-- Every statement is guarded (IF NOT EXISTS / CREATE OR REPLACE / DROP … IF
-- EXISTS), so it's safe to run more than once and against either schema.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- 1. Generator indexes on personal_recurring_tbl.
-- ---------------------------------------------------------------------

-- Due-template scan (the generator's hot path): only active rows, ordered by
-- when they next fire.
CREATE INDEX IF NOT EXISTS personal_recurring_due_idx
  ON personal_recurring_tbl (next_run_at)
  WHERE is_active = true;

-- Management lookups (the book's Recurring list).
CREATE INDEX IF NOT EXISTS personal_recurring_book_idx
  ON personal_recurring_tbl (book_id);

-- ---------------------------------------------------------------------
-- 2. Keep updated_at fresh on edits (pause/resume/amount changes). SECURITY
--    INVOKER is fine — it only touches NEW. Unqualified name resolves per the
--    SET above, so dev + prod each get their own copy.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_personal_recurring_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_personal_recurring_updated_at
  ON personal_recurring_tbl;
CREATE TRIGGER trg_touch_personal_recurring_updated_at
  BEFORE UPDATE ON personal_recurring_tbl
  FOR EACH ROW EXECUTE FUNCTION touch_personal_recurring_updated_at();

-- ---------------------------------------------------------------------
-- 3. Double-post backstop on personal_expenses_tbl — the same guarantee as
--    expenses_recurring_period_uidx gives group occurrences.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS personal_expenses_recurring_period_uidx
  ON personal_expenses_tbl (recurring_id, expense_date)
  WHERE recurring_id IS NOT NULL;
