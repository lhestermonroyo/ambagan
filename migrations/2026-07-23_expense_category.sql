-- ============================================================================
-- Expense category
--
-- Adds a per-expense spending category (Food, Transport, Groceries, …) so the
-- group Stats tab can break spending down by where the money went. Distinct
-- from the group-level `category` on groups_tbl (trip/event/household), which
-- describes the group, not an individual expense.
--
-- Defaults to 'other' so every existing row — and any insert that omits it
-- (offline-queued, recurring, legacy clients) — stays valid and simply shows
-- as "Other" until edited.
--
-- Safe to run more than once (IF NOT EXISTS guard).
-- ============================================================================

ALTER TABLE public.expenses_tbl
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';
