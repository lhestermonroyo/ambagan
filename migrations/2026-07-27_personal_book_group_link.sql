-- ============================================================================
-- Link a personal book to a group (trip) — private per-user expense log
--
-- On a group trip a member splits shared costs (dinner, lodging) but also makes
-- solo purchases they don't want to split. This adds an optional `group_id` to
-- personal_books_tbl so a personal book can be *attached* to a group: the solo
-- purchases live in the owner-only-RLS personal tables (private, never touch
-- settlement math) while the app can show a combined "what this trip cost ME"
-- total = my share of the group's split expenses + my personal expenses.
--
-- Group-linked books are EXEMPT from the free 2-book limit — a free user can
-- always start a trip log without hitting the paywall. The limit now counts only
-- standalone books (group_id IS NULL).
--
-- ----------------------------------------------------------------------------
-- DEV / PROD — same one-project, schema-split setup as
-- 2026-07-25_personal_expenses.sql. Apply to BOTH schemas; identifiers are
-- UNQUALIFIED and resolved via search_path, so the SET line below picks the
-- target. `groups_tbl` in the FK resolves within the target schema too (dev →
-- dev.groups_tbl), so no cross-schema FK drift.
--
-- >>> ROLLOUT ORDER (dev first, prod at release): <<<
--   * NOW — apply to DEV:      keep `SET search_path = dev, public, extensions;`
--   * AT RELEASE — apply to PROD: change it to `SET search_path = public, extensions;`
--
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE), safe to run more than once and
-- against each schema in turn.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- 1. group_id column — nullable link to the trip's group.
--    ON DELETE SET NULL: deleting the group leaves the private log intact as a
--    plain standalone book (the user keeps their records).
-- ---------------------------------------------------------------------
ALTER TABLE personal_books_tbl
  ADD COLUMN IF NOT EXISTS group_id uuid
  REFERENCES groups_tbl (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 2. One linked log per user per group — lets the app do a clean
--    find-or-create instead of spawning duplicate books for one trip.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS personal_books_user_group_uniq
  ON personal_books_tbl (user_id, group_id)
  WHERE group_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Free-limit trigger: exempt group-linked books, and count only
--    standalone (group_id IS NULL) books toward the cap. Recreated with the
--    same SECURITY DEFINER + pinned-search_path pattern as the original.
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
      -- A trip log is attached to a group and never counts against the limit.
      IF NEW.group_id IS NOT NULL THEN
        RETURN NEW;
      END IF;

      IF is_user_pro(NEW.user_id) THEN
        RETURN NEW;
      END IF;

      SELECT count(*) INTO book_count
      FROM personal_books_tbl
      WHERE user_id = NEW.user_id
        AND archived = false
        AND group_id IS NULL;

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
