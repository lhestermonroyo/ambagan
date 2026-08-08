-- ============================================================================
-- Settlement view preference
--
-- Lets each user choose how settlement rows render across the app:
--   'full'    — the default, detailed card (avatar, member/pays/payer stacked,
--               full status badge)
--   'compact' — a two-line row (description + relative date on top; "X pays Y",
--               amount and a status icon on the bottom)
--
-- Defaults to 'full' so existing users keep the current look until they opt in.
--
-- Safe to run more than once (IF NOT EXISTS guard).
-- ============================================================================

ALTER TABLE public.user_preferences_tbl
  ADD COLUMN IF NOT EXISTS settlement_view text NOT NULL DEFAULT 'full';
