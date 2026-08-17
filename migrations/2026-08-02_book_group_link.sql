-- ============================================================================
-- Link a personal book to a group — the "what did this cost ME" roll-up
--
-- On a trip a member splits shared costs in a GROUP but also makes solo
-- purchases they log in a personal BOOK. Same shape for a shared apartment:
-- shared bills in a group, own spending in a book. Neither surface can answer
-- "what did this trip / this month actually cost me?" on its own.
--
-- `personal_books_tbl.group_id` (added 2026-07-27, carried forward unused by
-- 2026-07-28_personal_books_v1.sql) is that link. This migration switches it on:
--   * a partial unique index so one user has at most ONE book per group,
--     letting the app do a clean find-or-create instead of spawning duplicates
--   * a membership guard so a book can only point at a group the owner is in
--
-- The link is DISPLAY-ONLY. Personal expenses stay in the owner-only-RLS tables
-- and never enter settlement math, balances, or any other member's view — the
-- roll-up is computed client-side from rows the owner can already read. No RLS
-- changes here, and that is deliberate: `personal_books_owner` staying
-- owner-only is exactly what keeps the personal half private.
--
-- ----------------------------------------------------------------------------
-- DEV / PROD — environments split by Postgres schema in ONE Supabase project
-- (`public` = prod, `dev` = isolated). Apply to BOTH. Identifiers are
-- UNQUALIFIED and resolved via the SET below, so you pick the target purely by
-- that one line.
--
-- >>> ROLLOUT ORDER (dev first, prod at release): <<<
--   * NOW — apply to DEV:         keep `SET search_path = dev, public, extensions;`
--   * AT RELEASE — apply to PROD: change it to `SET search_path = public, extensions;`
--
-- Idempotent (IF [NOT] EXISTS / CREATE OR REPLACE / DROP … IF EXISTS), safe to
-- run more than once and against each schema in turn.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- 1. One linked book per user per group.
--
-- Partial (WHERE group_id IS NOT NULL) so the unlimited standalone books —
-- which all carry a NULL group_id — don't collide with each other. This index
-- shipped in the abandoned 2026-07-27 migration and was dropped by the v1
-- rewrite; it's being restored, not invented.
--
-- It doubles as the lookup index for "my book for this group", which is the
-- query the group Stats card runs on every open.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS personal_books_user_group_uniq
  ON personal_books_tbl (user_id, group_id)
  WHERE group_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Membership guard — a book may only point at a group its owner belongs to.
--
-- NOT built on public.is_group_member(): that helper is SECURITY DEFINER with
-- `SET search_path = public`, so it always reads public.group_members_tbl. In
-- the `dev` schema it would check PROD membership and answer for the wrong
-- environment entirely. Instead this resolves the members table from
-- TG_TABLE_SCHEMA — the schema of the personal_books_tbl the trigger fired on —
-- so it always checks the SAME environment, exactly like
-- log_personal_expense_creation() in 2026-07-28_personal_books_v1.sql.
--
-- SECURITY DEFINER so the check sees the membership rows regardless of the
-- caller's own RLS view of group_members_tbl.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_book_group_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_member boolean;
BEGIN
  -- Unlinked (the overwhelmingly common case) is always allowed, and skipping
  -- the lookup keeps every standalone book write free of an extra query.
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- An UPDATE that doesn't touch the link (a rename, a budget edit) shouldn't
  -- re-validate — the user may since have left the group, and failing their
  -- rename because of that would be a surprise.
  IF TG_OP = 'UPDATE'
     AND OLD.group_id IS NOT DISTINCT FROM NEW.group_id
     AND OLD.user_id IS NOT DISTINCT FROM NEW.user_id THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I.group_members_tbl
       WHERE group_id = $1 AND member_id = $2
     )',
    TG_TABLE_SCHEMA
  ) INTO is_member USING NEW.group_id, NEW.user_id;

  IF NOT is_member THEN
    RAISE EXCEPTION 'Cannot link a book to a group you are not a member of'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_book_group_membership ON personal_books_tbl;
CREATE TRIGGER trg_enforce_book_group_membership
  BEFORE INSERT OR UPDATE ON personal_books_tbl
  FOR EACH ROW EXECUTE FUNCTION enforce_book_group_membership();

-- ---------------------------------------------------------------------
-- 3. Note on group deletion — nothing to do here.
--
-- personal_books_tbl_group_id_fkey is already ON DELETE SET NULL, so deleting a
-- group silently reverts the linked book to a plain standalone one. The owner
-- keeps every personal expense they recorded; only the roll-up goes away.
-- ---------------------------------------------------------------------
