-- ============================================================================
-- Recurring Expenses (Pro)
--
-- A recurring expense is a *template* (amount, description, currency, split
-- type, and a JSONB snapshot of who-paid / who-owes) plus a schedule. A daily
-- pg_cron job invokes the `run-recurring` Edge Function, which materializes a
-- real expense (+ payers + member splits + payment splits + notifications) for
-- every template whose next_run_at has passed — so a shared bill posts itself
-- even when nobody opens the app.
--
--   * recurring_expenses_tbl — the template + schedule + lifecycle state.
--   * expenses_tbl.recurring_id — links a generated occurrence back to its
--     series (drives the "Recurring" badge; occurrences stay independently
--     editable once posted). A partial unique index on (recurring_id,
--     expense_date) backstops the Edge Function against double-posting.
--   * is_user_pro() — SECURITY DEFINER helper; the generator skips (never
--     deletes) templates whose creator is no longer Pro, so they resume on
--     re-subscribe.
--   * pg_cron job — see the CONFIGURE block at the bottom (needs your project
--     ref + a Vault-stored service role key; the rest runs as-is).
--
-- Safe to run more than once (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY
-- IF EXISTS guards).
-- ============================================================================

-- ---------------------------------------------------------------------
-- recurring_expenses_tbl
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_expenses_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  group_id uuid NOT NULL,
  creator_id uuid NOT NULL,

  -- Expense template
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  currency text NOT NULL DEFAULT 'PHP',
  split_type text NOT NULL,
  -- [{ "userId": uuid, "amount": number }]
  payers_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "userId": uuid, "amount": number, "percentage": number }]
  splits_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Recurrence
  frequency text NOT NULL,               -- 'daily' | 'weekly' | 'monthly'
  repeat_interval integer NOT NULL DEFAULT 1,   -- every N frequency units
  start_date date NOT NULL,

  -- End condition
  end_type text NOT NULL DEFAULT 'never',       -- 'never' | 'on_date' | 'after_count'
  end_date date,
  occurrence_limit integer,
  occurrences_count integer NOT NULL DEFAULT 0,

  -- Scheduling / lifecycle
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,       -- pause / resume

  CONSTRAINT recurring_expenses_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT recurring_expenses_tbl_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES public.groups_tbl(id) ON DELETE CASCADE,
  CONSTRAINT recurring_expenses_tbl_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.users_tbl(id),
  CONSTRAINT recurring_expenses_frequency_chk
    CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  CONSTRAINT recurring_expenses_end_type_chk
    CHECK (end_type IN ('never', 'on_date', 'after_count')),
  CONSTRAINT recurring_expenses_interval_chk
    CHECK (repeat_interval >= 1)
);

-- Due-template scan (the generator's hot path) + management lookups.
CREATE INDEX IF NOT EXISTS recurring_expenses_due_idx
  ON public.recurring_expenses_tbl (next_run_at)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS recurring_expenses_group_idx
  ON public.recurring_expenses_tbl (group_id);
CREATE INDEX IF NOT EXISTS recurring_expenses_creator_idx
  ON public.recurring_expenses_tbl (creator_id);

-- Keep updated_at fresh on edits (pause/resume/amount changes).
CREATE OR REPLACE FUNCTION public.touch_recurring_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_recurring_updated_at ON public.recurring_expenses_tbl;
CREATE TRIGGER trg_touch_recurring_updated_at
  BEFORE UPDATE ON public.recurring_expenses_tbl
  FOR EACH ROW EXECUTE FUNCTION public.touch_recurring_updated_at();

-- ---------------------------------------------------------------------
-- expenses_tbl.recurring_id — link a generated occurrence to its series
-- ---------------------------------------------------------------------
ALTER TABLE public.expenses_tbl
  ADD COLUMN IF NOT EXISTS recurring_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'expenses_tbl_recurring_id_fkey'
  ) THEN
    ALTER TABLE public.expenses_tbl
      ADD CONSTRAINT expenses_tbl_recurring_id_fkey
      FOREIGN KEY (recurring_id)
      REFERENCES public.recurring_expenses_tbl(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Double-post backstop: the generator sets expense_date to a deterministic
-- per-period instant (the same runAt for the same period), so two overlapping
-- cron runs produce identical (recurring_id, expense_date) and the second insert
-- collides here instead of materializing the period twice. A plain column index
-- (no ::date cast) keeps the expression IMMUTABLE, which a functional index on a
-- timestamptz→date cast would not be.
CREATE UNIQUE INDEX IF NOT EXISTS expenses_recurring_period_uidx
  ON public.expenses_tbl (recurring_id, expense_date)
  WHERE recurring_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- is_user_pro() — active-Pro check (SECURITY DEFINER, like is_group_member)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_user_pro(
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_tbl
    WHERE id = _user_id
      AND plan = 'pro'
      AND (plan_expires_at IS NULL OR plan_expires_at > now())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_user_pro(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_user_pro(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- RLS: group members read; only the creator writes (admin may also delete).
-- The generator runs as service role and bypasses these.
-- ---------------------------------------------------------------------
ALTER TABLE public.recurring_expenses_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring_select_members" ON public.recurring_expenses_tbl;
CREATE POLICY "recurring_select_members" ON public.recurring_expenses_tbl
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "recurring_insert_creator" ON public.recurring_expenses_tbl;
CREATE POLICY "recurring_insert_creator" ON public.recurring_expenses_tbl
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND public.is_group_member(group_id));

DROP POLICY IF EXISTS "recurring_update_creator" ON public.recurring_expenses_tbl;
CREATE POLICY "recurring_update_creator" ON public.recurring_expenses_tbl
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "recurring_delete_creator_or_admin" ON public.recurring_expenses_tbl;
CREATE POLICY "recurring_delete_creator_or_admin" ON public.recurring_expenses_tbl
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid() OR public.is_group_admin(group_id));

-- ============================================================================
-- CONFIGURE — pg_cron → run-recurring Edge Function
--
-- Run these once in the Supabase SQL editor AFTER deploying the function
-- (`supabase functions deploy run-recurring`). Requires the pg_cron and pg_net
-- extensions (available on Supabase) and the service role key in Vault so it is
-- never stored in plaintext.
--
--   1. Store the service role key in Vault (Dashboard → Project Settings →
--      Vault, or):
--        select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--
--   2. Enable extensions + schedule an hourly run. Hourly (not daily) so a
--      template scheduled for "08:00" fires within the hour rather than at an
--      arbitrary time of day; the function only acts on templates whose
--      next_run_at has actually passed, so extra ticks are cheap no-ops.
--
--   Replace <PROJECT_REF> with your project ref.
-- ============================================================================
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'run-recurring-hourly',
--   '0 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/run-recurring',
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
-- To remove: select cron.unschedule('run-recurring-hourly');
