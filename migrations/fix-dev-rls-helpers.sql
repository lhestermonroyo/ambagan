-- ============================================================================
-- DEV-ONLY REPAIR — schema-local RLS helpers for the `dev` schema
--
-- Symptom this fixes: a group's recurring expenses never appear in the app on a
-- dev build, and creating one from Add Expense fails, even though the rows are
-- visible in the SQL editor.
--
-- Cause: `dev.recurring_expenses_tbl`'s policies were copied verbatim from
-- migrations/2026-07-21_recurring_expenses.sql, so they call
-- `public.is_group_member()` / `public.is_group_admin()`. Both helpers are
-- SECURITY DEFINER with `SET search_path = public`, so from the `dev` schema
-- they check **prod** membership: a dev-only group returns false. SELECT then
-- yields zero rows with no error (indistinguishable from "none exist") and
-- INSERT is rejected by the WITH CHECK. Same hazard the v1.4 deployment
-- checklist flags for log_personal_expense_creation() / the category trigger.
--
-- Fix: create `dev.`-pinned copies of the helpers, then recreate the policies
-- with UNQUALIFIED helper names under `search_path = dev, public` so they bind
-- to the dev copies. Prod is unaffected — `public.*` policies already resolve
-- to the public helpers and stay as they are.
--
-- Safe to run more than once (CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- ============================================================================

set search_path = dev, public, extensions;

-- ---------------------------------------------------------------------------
-- 1. dev-pinned helpers. Same signatures as the public ones (the second arg
--    defaults to auth.uid(), which is how the policies call them with one arg).
--    SECURITY DEFINER for the usual reason: the membership lookup must not be
--    re-filtered by group_members_tbl's own RLS, which would recurse.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dev.is_group_member(
  _group_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = dev
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dev.group_members_tbl
    WHERE group_id = _group_id
      AND member_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION dev.is_group_admin(
  _group_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = dev
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dev.groups_tbl
    WHERE id = _group_id
      AND admin_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION dev.is_group_member(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION dev.is_group_admin(uuid, uuid)  FROM public, anon;
GRANT  EXECUTE ON FUNCTION dev.is_group_member(uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION dev.is_group_admin(uuid, uuid)  TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Rebind the recurring policies. Helper names are intentionally UNQUALIFIED
--    so the search_path above binds them to dev.*; Postgres stores the resolved
--    name, so re-check with the audit in §3 after running.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "recurring_select_members" ON dev.recurring_expenses_tbl;
CREATE POLICY "recurring_select_members" ON dev.recurring_expenses_tbl
  FOR SELECT TO authenticated
  USING (is_group_member(group_id));

DROP POLICY IF EXISTS "recurring_insert_creator" ON dev.recurring_expenses_tbl;
CREATE POLICY "recurring_insert_creator" ON dev.recurring_expenses_tbl
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND is_group_member(group_id));

DROP POLICY IF EXISTS "recurring_delete_creator_or_admin" ON dev.recurring_expenses_tbl;
CREATE POLICY "recurring_delete_creator_or_admin" ON dev.recurring_expenses_tbl
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid() OR is_group_admin(group_id));

-- recurring_update_creator is already schema-agnostic (creator_id = auth.uid()
-- only), so it's left alone.

-- ---------------------------------------------------------------------------
-- 3. Audit — every OTHER dev policy still reaching into the public helpers.
--    Each one is the same latent bug for any row whose group exists only in dev.
--    Expect zero rows for recurring_expenses_tbl after §2.
-- ---------------------------------------------------------------------------
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'dev'
  and (qual like '%public.is_group%' or with_check like '%public.is_group%')
order by tablename, policyname;

-- ---------------------------------------------------------------------------
-- 4. Verify the read path as the app sees it. Should return your group's
--    templates once §2 has run (swap in your own ids).
-- ---------------------------------------------------------------------------
-- select dev.is_group_member('YOUR_GROUP_ID'::uuid, 'YOUR_USER_ID'::uuid);
