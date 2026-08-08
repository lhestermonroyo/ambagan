-- ============================================================================
-- Personal Expenses — v1 "Books" realignment
--
-- The original personal-expense attempt (2026-07-25_personal_expenses.sql +
-- 2026-07-27_personal_book_group_link.sql) shipped a global `app_mode` toggle, a
-- 2-book free cap, and a global monthly_budget. The v1 pivot (2026-07-28) drops
-- all of that: personal is now a standalone "Books" surface (no global mode),
-- books are UNLIMITED for everyone, and the free tier is gated by a per-day
-- expense limit (5/day) via an append-only creation log — a SEPARATE bucket from
-- the group expense_creation_log_tbl.
--
-- This migration is IDEMPOTENT and brings any starting state to the v1 target:
--   * fresh DB          → creates the personal tables + log + trigger + RLS
--   * old attempt applied → adds the creation log, DROPS the 2-book-limit
--                           trigger/function, DROPS app_mode + monthly_budget
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
-- Existence checks are scoped to current_schema() and every statement is guarded
-- (IF [NOT] EXISTS / CREATE OR REPLACE / DROP … IF EXISTS), so it's safe to run
-- more than once and against either schema.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- 1. Drop the abandoned global-mode artifacts (no-ops if never created).
-- ---------------------------------------------------------------------

-- The global solo toggle + old global budget — nothing in the app reads these
-- anymore (mode is gone; budget is now per-book, design-for-later). Dropping the
-- column also drops its CHECK constraint.
ALTER TABLE user_preferences_tbl DROP COLUMN IF EXISTS app_mode;
ALTER TABLE user_preferences_tbl DROP COLUMN IF EXISTS monthly_budget;

-- The 2-book free cap is gone (books are unlimited in v1). Drop trigger then fn.
-- The table guard is load-bearing: `DROP TRIGGER IF EXISTS … ON t` still errors
-- with "relation t does not exist" when t is absent — the IF EXISTS covers the
-- trigger, not the table. Without this, the whole file fails on its first
-- statement against a FRESH schema (i.e. prod), which is exactly the case the
-- header promises to support. It only ever passed on dev because the pre-pivot
-- migration had already created personal_books_tbl there.
DO $$
BEGIN
  IF to_regclass(current_schema() || '.personal_books_tbl') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_enforce_personal_book_limit ON personal_books_tbl';
  END IF;
END $$;
DROP FUNCTION IF EXISTS enforce_personal_book_limit();

-- ---------------------------------------------------------------------
-- 2. personal_books_tbl — the standalone ledger (owner-only).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_books_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  avatar text,
  currency text NOT NULL DEFAULT 'PHP',
  -- Forward-compat (v1: design-for, not built): per-book monthly cap.
  budget numeric,
  archived boolean NOT NULL DEFAULT false,
  -- Forward-compat (v1: unused): future group→book roll-up link.
  group_id uuid,

  CONSTRAINT personal_books_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT personal_books_tbl_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users_tbl(id) ON DELETE CASCADE
);

-- Bring an EXISTING table (from the old attempt) up to the v1 shape.
ALTER TABLE personal_books_tbl ADD COLUMN IF NOT EXISTS budget numeric;
ALTER TABLE personal_books_tbl ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE personal_books_tbl ALTER COLUMN category SET DEFAULT 'general';

CREATE INDEX IF NOT EXISTS personal_books_user_idx
  ON personal_books_tbl (user_id)
  WHERE archived = false;

-- group_id FK (nullable, unused in v1). Guarded so a re-run / fresh install both
-- end with exactly one copy of the constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_books_tbl_group_id_fkey'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE personal_books_tbl
      ADD CONSTRAINT personal_books_tbl_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES groups_tbl(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. personal_recurring_tbl — kept for forward-compat (v1 builds no recurring
--    features, but personal_expenses_tbl.recurring_id references it).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_recurring_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  currency text NOT NULL DEFAULT 'PHP',
  frequency text NOT NULL,
  repeat_interval integer NOT NULL DEFAULT 1,
  start_date date NOT NULL,
  end_type text NOT NULL DEFAULT 'never',
  end_date date,
  occurrence_limit integer,
  occurrences_count integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,

  CONSTRAINT personal_recurring_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT personal_recurring_tbl_book_id_fkey
    FOREIGN KEY (book_id) REFERENCES personal_books_tbl(id) ON DELETE CASCADE,
  CONSTRAINT personal_recurring_tbl_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users_tbl(id) ON DELETE CASCADE,
  CONSTRAINT personal_recurring_frequency_chk
    CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  CONSTRAINT personal_recurring_end_type_chk
    CHECK (end_type IN ('never', 'on_date', 'after_count')),
  CONSTRAINT personal_recurring_interval_chk
    CHECK (repeat_interval >= 1)
);

-- ---------------------------------------------------------------------
-- 4. personal_expenses_tbl — one solo entry (no payers/splits/settlements).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_expenses_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  currency text NOT NULL DEFAULT 'PHP',
  expense_date timestamptz NOT NULL DEFAULT now(),
  proof_of_payment text,
  recurring_id uuid,

  CONSTRAINT personal_expenses_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT personal_expenses_tbl_book_id_fkey
    FOREIGN KEY (book_id) REFERENCES personal_books_tbl(id) ON DELETE CASCADE,
  CONSTRAINT personal_expenses_tbl_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users_tbl(id) ON DELETE CASCADE
);

ALTER TABLE personal_expenses_tbl ALTER COLUMN category SET DEFAULT 'general';

CREATE INDEX IF NOT EXISTS personal_expenses_book_idx
  ON personal_expenses_tbl (book_id);
CREATE INDEX IF NOT EXISTS personal_expenses_user_idx
  ON personal_expenses_tbl (user_id);

-- recurring_id FK (nullable) — guarded so fresh + existing installs converge.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_expenses_tbl_recurring_id_fkey'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE personal_expenses_tbl
      ADD CONSTRAINT personal_expenses_tbl_recurring_id_fkey
      FOREIGN KEY (recurring_id)
      REFERENCES personal_recurring_tbl(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. personal_expense_creation_log_tbl — append-only free-tier meter.
--
-- Written by an AFTER INSERT trigger on personal_expenses_tbl and NEVER touched
-- on delete, so the 5/day free limit can't be refunded by deleting an expense.
-- Mirrors expense_creation_log_tbl but is a SEPARATE bucket (5 group + 5
-- personal per day). No user_id FK, matching the group log.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_expense_creation_log_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_expense_creation_log_tbl_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS personal_expense_creation_log_user_day_idx
  ON personal_expense_creation_log_tbl (user_id, created_at);

-- SECURITY DEFINER so the insert bypasses the log's own RLS (no direct-write
-- policy exists — the log must only be written by this trigger). The target
-- table is qualified with TG_TABLE_SCHEMA (the schema of personal_expenses_tbl),
-- so this resolves to the SAME environment's log table regardless of the
-- caller's search_path — no per-schema hardcoding needed.
CREATE OR REPLACE FUNCTION log_personal_expense_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'INSERT INTO %I.personal_expense_creation_log_tbl (user_id) VALUES ($1)',
    TG_TABLE_SCHEMA
  ) USING NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_personal_expense_creation ON personal_expenses_tbl;
CREATE TRIGGER trg_log_personal_expense_creation
  AFTER INSERT ON personal_expenses_tbl
  FOR EACH ROW EXECUTE FUNCTION log_personal_expense_creation();

-- ---------------------------------------------------------------------
-- 6. RLS — every personal row is owned by exactly one user.
-- ---------------------------------------------------------------------
ALTER TABLE personal_books_tbl ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_expenses_tbl ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_recurring_tbl ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_expense_creation_log_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_books_owner" ON personal_books_tbl;
CREATE POLICY "personal_books_owner" ON personal_books_tbl
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "personal_expenses_owner" ON personal_expenses_tbl;
CREATE POLICY "personal_expenses_owner" ON personal_expenses_tbl
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "personal_recurring_owner" ON personal_recurring_tbl;
CREATE POLICY "personal_recurring_owner" ON personal_recurring_tbl
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Log is READ-only to its owner (for the daily count query). Inserts happen only
-- via the SECURITY DEFINER trigger above; there is deliberately no write policy.
DROP POLICY IF EXISTS "personal_expense_log_select_own" ON personal_expense_creation_log_tbl;
CREATE POLICY "personal_expense_log_select_own" ON personal_expense_creation_log_tbl
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Grants mirror the rest of the schema (RLS still governs row visibility). The
-- log gets SELECT only — no INSERT/UPDATE/DELETE, so it can't be tampered with.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON personal_books_tbl, personal_expenses_tbl, personal_recurring_tbl
  TO authenticated;
GRANT SELECT ON personal_expense_creation_log_tbl TO authenticated;
