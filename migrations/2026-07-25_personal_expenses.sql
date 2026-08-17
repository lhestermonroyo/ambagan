-- ============================================================================
-- Personal (Individual) Expense Mode
--
-- Ambagan is a split-with-friends app: every expense hangs off a group and the
-- whole model is settlement-centric (groups → expenses → payers + member_splits
-- + payment_splits). This migration adds a parallel, settlement-free domain so a
-- single user can track their own spending inside trip/bill/etc. "books":
--
--   * personal_books_tbl      — the trip/bill container (a solo "group").
--   * personal_expenses_tbl   — one solo entry (no payers, no splits).
--   * personal_recurring_tbl  — a recurring template + schedule (Pro), a trimmed
--                               copy of recurring_expenses_tbl with no
--                               payers/splits snapshots (solo → nothing to split).
--   * user_preferences_tbl.app_mode — 'split' (default) | 'personal'. Drives the
--                               global solo toggle in the app.
--
-- RLS is trivial here — every row is owned by exactly one user, so policies are
-- plain `user_id = auth.uid()` (no is_group_member/SECURITY DEFINER helpers).
-- The recurring generator (run-personal-recurring Edge Function) runs as service
-- role and bypasses RLS.
--
-- Free tier is capped at 2 non-archived books; a BEFORE INSERT trigger enforces
-- it server-side (the client also guards + shows the Pro upsell). Reuses
-- is_user_pro() (unqualified, resolved via search_path — exists in both schemas).
--
-- ----------------------------------------------------------------------------
-- DEV / PROD — this project splits environments by Postgres schema in ONE
-- Supabase project (`public` = prod, `dev` = isolated). Apply this migration to
-- BOTH schemas. It is written schema-agnostic: identifiers are UNQUALIFIED and
-- resolved via search_path, so you pick the target purely by the SET below.
--
-- >>> ROLLOUT ORDER (dev first, prod at release): <<<
--   * NOW — apply to DEV:     keep `SET search_path = dev, public, extensions;`
--   * AT RELEASE — apply to PROD: change it to `SET search_path = public, extensions;`
--
-- The default below targets DEV so pasting this file into the Supabase SQL editor
-- as-is can never touch prod. Flip the one SET line when you're ready to release.
--
-- Because REFERENCES and helper-function refs (is_user_pro,
-- touch_recurring_updated_at) are unqualified too, they resolve within the
-- target schema first — so dev tables get dev→dev FKs (no PGRST200 embed drift),
-- and the dev is_user_pro reads dev.users_tbl. No sync-dev-fks.sql pass is
-- needed for these tables when created this way (only re-run that script if the
-- tables were instead brought in via clone_schema).
--
-- SELF-CONTAINED: the two helpers this leans on (touch_recurring_updated_at,
-- is_user_pro) are (re)created below IF they're missing from the target schema,
-- so this applies cleanly even if the recurring migration never reached `dev`.
--
-- Existence checks are scoped to current_schema() so running the file against
-- the second schema doesn't skip a constraint just because the first schema
-- already has it. Safe to run more than once (IF NOT EXISTS / CREATE OR REPLACE
-- / DROP … IF EXISTS guards).
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- Helper prerequisites — ensure they exist in the TARGET schema. Both are
-- normally created by 2026-07-21_recurring_expenses.sql; guarded here so a `dev`
-- that never got that migration still applies cleanly. Unqualified → target
-- schema (search_path). No-ops when they already exist.
-- ---------------------------------------------------------------------

-- Bumps updated_at on every row update (used by the personal_recurring trigger).
-- Safe to CREATE OR REPLACE — identical body to the group version, no grants.
CREATE OR REPLACE FUNCTION touch_recurring_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Active-Pro check. Only created if absent, so an existing hardened definition
-- (with its REVOKE/GRANT posture) is never clobbered. search_path is pinned to
-- the CURRENT schema so the SECURITY DEFINER function reads the right users_tbl.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_user_pro'
      AND pronamespace = current_schema()::regnamespace
  ) THEN
    EXECUTE format(
      $fn$
      CREATE FUNCTION is_user_pro(_user_id uuid DEFAULT auth.uid())
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      SET search_path = %I, public, extensions
      AS $body$
        SELECT EXISTS (
          SELECT 1 FROM users_tbl
          WHERE id = _user_id
            AND plan = 'pro'
            AND (plan_expires_at IS NULL OR plan_expires_at > now())
        );
      $body$;
      $fn$,
      current_schema()
    );
    REVOKE EXECUTE ON FUNCTION is_user_pro(uuid) FROM public, anon;
    GRANT EXECUTE ON FUNCTION is_user_pro(uuid) TO authenticated;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- user_preferences_tbl.app_mode — the global solo toggle
-- ---------------------------------------------------------------------
ALTER TABLE user_preferences_tbl
  ADD COLUMN IF NOT EXISTS app_mode text NOT NULL DEFAULT 'split';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preferences_app_mode_chk'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE user_preferences_tbl
      ADD CONSTRAINT user_preferences_app_mode_chk
      CHECK (app_mode IN ('split', 'personal'));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- personal_books_tbl — the trip/bill container
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_books_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  -- Reuses GroupCategory values (trip/event/household/work/couple/family/other).
  category text NOT NULL DEFAULT 'other',
  avatar text,
  currency text NOT NULL DEFAULT 'PHP',
  -- Optional per-book budget (null = no budget set).
  budget numeric,
  archived boolean NOT NULL DEFAULT false,

  CONSTRAINT personal_books_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT personal_books_tbl_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users_tbl(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS personal_books_user_idx
  ON personal_books_tbl (user_id)
  WHERE archived = false;

-- ---------------------------------------------------------------------
-- personal_expenses_tbl — one solo entry
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_expenses_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  -- Reuses ExpenseCategory values; 'other' is the implicit fallback.
  category text NOT NULL DEFAULT 'other',
  currency text NOT NULL DEFAULT 'PHP',
  expense_date timestamptz NOT NULL DEFAULT now(),
  proof_of_payment text,
  -- Set when auto-generated from a personal_recurring_tbl template; null for
  -- one-off entries.
  recurring_id uuid,

  CONSTRAINT personal_expenses_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT personal_expenses_tbl_book_id_fkey
    FOREIGN KEY (book_id) REFERENCES personal_books_tbl(id) ON DELETE CASCADE,
  CONSTRAINT personal_expenses_tbl_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users_tbl(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS personal_expenses_book_idx
  ON personal_expenses_tbl (book_id);
CREATE INDEX IF NOT EXISTS personal_expenses_user_idx
  ON personal_expenses_tbl (user_id);

-- ---------------------------------------------------------------------
-- personal_recurring_tbl — recurring template + schedule (Pro)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_recurring_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,

  -- Expense template (no payers/splits snapshots — solo).
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  currency text NOT NULL DEFAULT 'PHP',

  -- Recurrence
  frequency text NOT NULL,                     -- 'daily' | 'weekly' | 'monthly'
  repeat_interval integer NOT NULL DEFAULT 1,  -- every N frequency units
  start_date date NOT NULL,

  -- End condition
  end_type text NOT NULL DEFAULT 'never',      -- 'never' | 'on_date' | 'after_count'
  end_date date,
  occurrence_limit integer,
  occurrences_count integer NOT NULL DEFAULT 0,

  -- Scheduling / lifecycle
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,     -- pause / resume

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

CREATE INDEX IF NOT EXISTS personal_recurring_due_idx
  ON personal_recurring_tbl (next_run_at)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS personal_recurring_book_idx
  ON personal_recurring_tbl (book_id);
CREATE INDEX IF NOT EXISTS personal_recurring_user_idx
  ON personal_recurring_tbl (user_id);

-- Link a generated occurrence back to its series (mirrors expenses_tbl.recurring_id).
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

-- Double-post backstop: the generator sets expense_date to a deterministic
-- per-period instant, so two overlapping cron runs collide here instead of
-- materializing the period twice (plain column index keeps it IMMUTABLE).
CREATE UNIQUE INDEX IF NOT EXISTS personal_expenses_recurring_period_uidx
  ON personal_expenses_tbl (recurring_id, expense_date)
  WHERE recurring_id IS NOT NULL;

-- Keep updated_at fresh on edits (reuses the shared touch trigger fn from the
-- group recurring migration; unqualified → resolves in the target schema).
DROP TRIGGER IF EXISTS trg_touch_personal_recurring_updated_at ON personal_recurring_tbl;
CREATE TRIGGER trg_touch_personal_recurring_updated_at
  BEFORE UPDATE ON personal_recurring_tbl
  FOR EACH ROW EXECUTE FUNCTION touch_recurring_updated_at();

-- ---------------------------------------------------------------------
-- Free-tier limit: at most 2 non-archived books unless the user is Pro.
-- SECURITY DEFINER + an explicit search_path pinned to the CURRENT schema so the
-- function keeps reading the same environment's tables/helpers after creation.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  EXECUTE format(
    $fn$
    CREATE OR REPLACE FUNCTION enforce_personal_book_limit()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = %I, public, extensions
    AS $body$
    DECLARE
      book_count integer;
    BEGIN
      IF is_user_pro(NEW.user_id) THEN
        RETURN NEW;
      END IF;

      SELECT count(*) INTO book_count
      FROM personal_books_tbl
      WHERE user_id = NEW.user_id AND archived = false;

      IF book_count >= 2 THEN
        RAISE EXCEPTION 'personal_book_limit_reached'
          USING HINT = 'Upgrade to Ambagan Pro for unlimited personal books.';
      END IF;

      RETURN NEW;
    END;
    $body$;
    $fn$,
    current_schema()
  );
END $$;

DROP TRIGGER IF EXISTS trg_enforce_personal_book_limit ON personal_books_tbl;
CREATE TRIGGER trg_enforce_personal_book_limit
  BEFORE INSERT ON personal_books_tbl
  FOR EACH ROW EXECUTE FUNCTION enforce_personal_book_limit();

-- ---------------------------------------------------------------------
-- RLS — every row is owned by exactly one user.
-- ---------------------------------------------------------------------
ALTER TABLE personal_books_tbl ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_expenses_tbl ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_recurring_tbl ENABLE ROW LEVEL SECURITY;

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

-- Grants mirror the rest of the schema (RLS still governs row visibility).
GRANT SELECT, INSERT, UPDATE, DELETE
  ON personal_books_tbl, personal_expenses_tbl, personal_recurring_tbl
  TO authenticated;

-- ============================================================================
-- CONFIGURE — pg_cron → run-personal-recurring Edge Function (prod + dev)
--
-- Run these once in the Supabase SQL editor AFTER deploying the functions:
--   supabase functions deploy run-personal-recurring
--   supabase functions deploy run-personal-recurring-dev
--
-- Reuses the same Vault 'service_role_key' secret created for run-recurring.
-- Staggered off the run-recurring jobs (prod :00 / dev :30) so the ticks don't
-- pile up: personal prod at :15, personal dev at :45. Each function no-ops on
-- templates whose next_run_at hasn't passed.
--
--   Replace <PROJECT_REF> with your project ref (zwlzyvvhgfmffjzzvrjx).
-- ============================================================================
--
-- -- Prod (public schema):
-- select cron.schedule(
--   'run-personal-recurring-hourly',
--   '15 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/run-personal-recurring',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (
--         select decrypted_secret from vault.decrypted_secrets
--         where name = 'service_role_key'
--       )
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- -- Dev (dev schema) — hits the `-dev` URL so the handler targets `dev`:
-- select cron.schedule(
--   'run-personal-recurring-dev-hourly',
--   '45 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/run-personal-recurring-dev',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (
--         select decrypted_secret from vault.decrypted_secrets
--         where name = 'service_role_key'
--       )
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- To remove: select cron.unschedule('run-personal-recurring-hourly');
--            select cron.unschedule('run-personal-recurring-dev-hourly');
