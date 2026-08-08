-- ============================================================================
-- Recurring expense category
--
-- Mirrors expenses_tbl.category (see 2026-07-23_expense_category.sql) onto the
-- recurring template so a series carries a spending category (Food, Transport,
-- …). The run-recurring generator copies this onto every materialized
-- occurrence, so a recurring bill shows the same category icon as a one-off
-- expense in the group's list.
--
-- Defaults to 'other' so existing templates — and any insert that omits it —
-- stay valid and simply show as "Other" until edited.
--
-- Safe to run more than once (IF NOT EXISTS guard).
-- ============================================================================

ALTER TABLE public.recurring_expenses_tbl
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';
