-- ============================================================================
-- Recurring expense notifications
--
-- Until now the recurring generator (`run-recurring`) only told *other* people
-- something happened: group members got an `expense_inclusion` notification for
-- each auto-posted expense, and the creator got a mis-typed `expense_inclusion`
-- when a template degraded to a draft. The person who set the series up got
-- nothing when it worked, and personal (book) recurring — which has no other
-- members to notify — was completely silent, so a Pro user's book expenses
-- appeared out of nowhere.
--
-- Two new notification types now cover that gap:
--
--   'recurring_posted' — a template auto-posted. Sent to the creator (group) or
--                        owner (book). reference_id is the generated expense —
--                        `expenses_tbl` for a group, `personal_expenses_tbl`
--                        for a book, resolved by trying group first
--                        (notification.service.ts → getNotificationRoute).
--   'recurring_review' — a GROUP occurrence posted as a draft because members
--                        left and the stored split no longer reconciles. Sent to
--                        the creator only; replaces the `expense_inclusion` this
--                        case used to borrow.
--
-- `notifications_tbl.type` is a plain `text` column with no CHECK constraint, so
-- the new values need no DDL there — this migration only adds the preference
-- column that gates their push delivery.
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
-- Every statement is guarded, so this is safe to run more than once and against
-- either schema.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- 1. notif_recurring_expense — push toggle for both recurring types.
-- ---------------------------------------------------------------------
-- One switch covers 'recurring_posted' and 'recurring_review' across group and
-- book (see NOTIF_PREF_KEY in supabase/functions/_shared/send-push.ts and
-- run-recurring.ts) — a user who wants to hear about their series wants both
-- halves, and splitting them would leave the draft warning silenceable on its
-- own, which is the one message they can least afford to miss.
--
-- DEFAULT true matches every other notif_* column: notifications are opt-out.
-- Existing rows take the default, so no backfill is needed. The generator reads
-- the column with `!prefs[key]`, meaning an older client that never writes it is
-- still opted in.
ALTER TABLE user_preferences_tbl
  ADD COLUMN IF NOT EXISTS notif_recurring_expense boolean NOT NULL DEFAULT true;

-- PostgREST caches the schema; without this the app hits PGRST204 ("Could not
-- find the 'notif_recurring_expense' column … in the schema cache") on the
-- first preference write — and, worse, the Edge Function's `select` of the
-- column fails, which reads as "pref off" and silently drops every recurring
-- push until the cache catches up on its own.
NOTIFY pgrst, 'reload schema';
