-- ============================================================================
-- fx_refresh_log_tbl — a durable record of every refresh-fx-rates run.
--
-- Companion to 2026-08-01_fx_rates.sql. Exists because the refresh fails
-- SILENTLY otherwise:
--   * `cron.job_run_details` only reports whether the SQL statement ran — a
--     function returning 401 or 502 still shows `succeeded`.
--   * `net._http_response` holds the real HTTP status but pg_net prunes it
--     after a few hours, so a Monday failure is unrecoverable by Tuesday.
--   * The app degrades gracefully to stale rates, so nothing user-visible
--     breaks either — the budget card just quietly ages.
--
-- One row per run, success or failure, written by the function itself. Answers
-- "when did this last actually work, and what went wrong?" with one query.
--
-- ----------------------------------------------------------------------------
-- DEV / PROD — environments split by Postgres schema in ONE Supabase project
-- (`public` = prod, `dev` = isolated). Apply to BOTH. Identifiers are
-- UNQUALIFIED and resolved via the SET below, so the target is picked purely by
-- that one line.
--
-- >>> ROLLOUT ORDER (dev first, prod at release): <<<
--   * NOW — apply to DEV:         keep the SET line below as `dev, public, extensions`
--   * AT RELEASE — apply to PROD: change it to `public, extensions`
--
-- Guarded throughout, so it's safe to re-run against either schema.
--
-- NOTE — this file contains NO semicolons inside comments, deliberately.
-- Editors that split statements client-side before sending them can treat one
-- as a statement boundary and cut a CREATE TABLE in half, producing a baffling
-- "syntax error at or near <table_name>" on SQL that is perfectly valid.
-- Postgres itself parses it fine, so this is purely a client-side hazard.
-- Keep it that way.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

CREATE TABLE IF NOT EXISTS fx_refresh_log_tbl (
  id             bigserial PRIMARY KEY,
  ran_at         timestamptz NOT NULL DEFAULT now(),
  -- The single field worth alerting on.
  ok             boolean NOT NULL,
  -- Short machine-readable outcome: 'ok' | 'fetch_failed' | 'feed_invalid'
  -- | 'too_many_rejected' | 'write_failed'.
  status         text NOT NULL,
  -- Feed's own publication date for the rates written (NULL on failure).
  as_of          date,
  updated_count  integer,
  -- [{currency, reason}] for rates that failed validation and kept their
  -- previous value. Non-empty with ok = true is survivable — the same currency
  -- appearing week after week is the thing to look at.
  rejected       jsonb,
  error          text
);

-- ---------------------------------------------------------------------
-- RLS — service role only.
-- ---------------------------------------------------------------------
-- Deliberately NO policies of any kind: the app never reads this, and the
-- function writes as the service role, which bypasses RLS. Enabling RLS with an
-- empty policy set means any client key sees nothing at all.
ALTER TABLE fx_refresh_log_tbl ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Reading it (SQL editor, service role). Queries are written WITHOUT trailing
-- semicolons on purpose — see the note at the top of this file.
--
--   last 10 runs
--     select ran_at, ok, status, as_of, updated_count, rejected, error
--     from fx_refresh_log_tbl order by ran_at desc limit 10
--
--   when did it last actually work
--     select max(ran_at) from fx_refresh_log_tbl where ok
--
--   currencies that keep getting rejected
--     select r->>'currency' as currency, count(*)
--     from fx_refresh_log_tbl, jsonb_array_elements(rejected) r
--     where ran_at > now() - interval '90 days'
--     group by 1 order by 2 desc
--
-- The function prunes rows older than 180 days on each run, so this stays a few
-- dozen rows and needs no index.
-- ============================================================================
