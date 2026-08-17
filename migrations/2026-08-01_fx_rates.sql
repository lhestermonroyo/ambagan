-- ============================================================================
-- Indicative FX rates — one global table, refreshed weekly by pg_cron.
--
-- Exists for ONE screen: the book budget card. A budget bar has to be a single
-- number, so a mixed PHP/JPY book has to convert something; everywhere else in
-- the app (balances, settlements, per-currency totals) money stays split by
-- currency and is NEVER converted.
--
-- Design notes:
--   * Rates are only ever read for DISPLAY. Expenses keep the currency and
--     amount they were entered in, so refreshing this table re-prices history
--     with no backfill.
--   * `as_of` travels with the rates and is rendered next to every converted
--     figure. That's what makes a dead cron self-disclosing: the card shows an
--     ageing date instead of a silently stale number.
--   * Global, not per-user — no user_id, and every authenticated user reads the
--     same rows.
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
-- Every statement is guarded, so this is safe to re-run against either schema.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- 1. The table.
-- ---------------------------------------------------------------------
-- php_per_unit: PHP per 1 unit of `currency`. PHP is the anchor purely because
-- it's the app default — cross-rates are derived client-side, so any pair works.
-- The CHECK is the last line of defence against a bad feed writing 0 or a
-- negative rate, which would silently zero out a user's converted spend.
CREATE TABLE IF NOT EXISTS fx_rates_tbl (
  currency      text PRIMARY KEY,
  php_per_unit  numeric NOT NULL CHECK (php_per_unit > 0),
  as_of         date NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. RLS — world-readable to signed-in users, writable only by the cron.
-- ---------------------------------------------------------------------
-- There is deliberately NO insert/update/delete policy: the refresh-fx-rates
-- Edge Function runs as the service role, which bypasses RLS. So no client can
-- ever poison the rate table, even with a stolen anon key.
ALTER TABLE fx_rates_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fx_rates_select_authenticated" ON fx_rates_tbl;
CREATE POLICY "fx_rates_select_authenticated"
  ON fx_rates_tbl FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------
-- 3. Seed — the app's shipped baseline.
-- ---------------------------------------------------------------------
-- Mirrors FALLBACK in utils/fx.ts so the card is correct the moment the table
-- exists, before the first cron tick. ON CONFLICT DO NOTHING means a re-run
-- never clobbers a fresher rate the cron has since written.
--
-- Values are a real snapshot of open.er-api.com taken 2026-08-01 (inverted from
-- its PHP-anchored quotes). They age from the day they ship — the cron is what
-- keeps them honest.
INSERT INTO fx_rates_tbl (currency, php_per_unit, as_of) VALUES
  ('PHP', 1,        DATE '2026-08-01'),
  ('USD', 61.25,    DATE '2026-08-01'),
  ('EUR', 70.51,    DATE '2026-08-01'),
  ('JPY', 0.3837,   DATE '2026-08-01'),
  ('GBP', 82.44,    DATE '2026-08-01'),
  ('CNY', 9.099,    DATE '2026-08-01'),
  ('KRW', 0.04252,  DATE '2026-08-01'),
  ('SGD', 47.72,    DATE '2026-08-01'),
  ('VND', 0.002333, DATE '2026-08-01'),
  ('THB', 1.832,    DATE '2026-08-01'),
  ('TWD', 1.898,    DATE '2026-08-01'),
  ('MYR', 14.99,    DATE '2026-08-01'),
  ('IDR', 0.003395, DATE '2026-08-01'),
  ('INR', 0.6415,   DATE '2026-08-01')
ON CONFLICT (currency) DO NOTHING;

-- ============================================================================
-- 4. CRON — run manually in the SQL editor, once per environment.
--
-- Weekly is the right cadence here: this drives an approximate budget
-- indicator, not a settlement. Major pairs move well under a percent or two
-- over a week, and a weekly tick keeps both the request volume and the blast
-- radius of a bad feed small. The function is idempotent, so a missed week just
-- means the next tick catches up.
--
-- Dev uses the `-dev` function URL, which resolves to the `dev` schema (see
-- supabase/functions/_shared/schema.ts).
--
-- Vault note: `service_role_key` MUST hold the NEW `sb_secret_…` key, not the
-- legacy `eyJ…` JWT, or the function returns 401. Rolling the key rebreaks it.
--
-- Replace <PROJECT_REF> with your project ref.
-- ============================================================================
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- Invoke it by hand ONCE before scheduling — a job that 401s on the Vault key
-- fails silently every week otherwise. Response lands in net._http_response.
--
-- select cron.schedule(
--   'refresh-fx-rates-weekly',
--   '10 3 * * 1',                     -- Mondays, 03:10 UTC (11:10 Manila)
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/refresh-fx-rates',
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
-- To remove: select cron.unschedule('refresh-fx-rates-weekly');
