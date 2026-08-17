-- Set the category column default to 'general' (the new default category) on
-- every table that stores a category. Previously these defaulted to 'other'
-- (except dev.groups_tbl / public.groups_tbl, which had no default at all).
--
-- Scope: DEFAULT only. This changes what a row gets when inserted without a
-- category; it does NOT rewrite existing rows. The app already sends a category
-- on every insert, so this just keeps the server default aligned with the client.
--
-- Run against the one Supabase project. Both schemas are covered:
--   dev.*    -> used by __DEV__ builds
--   public.* -> used by production builds
-- Idempotent: re-running sets the same default.

-- ── dev schema ───────────────────────────────────────────────────────────────
ALTER TABLE dev.groups_tbl              ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE dev.expenses_tbl            ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE dev.recurring_expenses_tbl  ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE dev.personal_books_tbl      ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE dev.personal_expenses_tbl   ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE dev.personal_recurring_tbl  ALTER COLUMN category SET DEFAULT 'general';

-- ── public (prod) schema ─────────────────────────────────────────────────────
ALTER TABLE public.groups_tbl             ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE public.expenses_tbl           ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE public.recurring_expenses_tbl ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE public.personal_books_tbl     ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE public.personal_expenses_tbl  ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE public.personal_recurring_tbl ALTER COLUMN category SET DEFAULT 'general';
