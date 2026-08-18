-- ============================================================================
-- App versions — the one row per platform that tells an installed build whether
-- it is out of date.
--
-- Exists because the two update paths cover different ground and neither covers
-- all of it:
--
--   * EAS Update (OTA) ships JS-only changes silently, with no prompt at all —
--     but ONLY to builds whose runtimeVersion fingerprint matches, and only to
--     builds that shipped WITH expo-updates in the binary. Every install from
--     v1.4 and earlier is permanently outside it.
--   * A native release (SDK bump, new native module, changed permissions) can
--     never be an OTA. iOS has no API to trigger an install, so the only lever
--     left is asking, and the only way to ask is to know we're behind.
--
-- This table is that knowledge. It is deliberately SERVER-side rather than a
-- store lookup: the App Store's own version endpoint has no Play equivalent, it
-- flips the moment review approves rather than when we're ready, and it can't
-- carry release notes or a kill-switch floor.
--
-- Two thresholds, because "newer exists" and "this build is broken" are
-- different facts and want different UI:
--
--   * latest_version       — newer exists. Dismissible nudge, snoozed client-side.
--   * min_supported_version — this build must not keep running (a data-corrupting
--                             bug, a dead API contract). Blocking, no dismiss.
--
-- Keep min_supported_version well BEHIND latest_version in normal operation.
-- Raising it strands anyone who cannot update (an old OS, no storage), so it is
-- an incident tool, not a release step.
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

SET search_path = public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- 1. The table.
-- ---------------------------------------------------------------------
-- One row per platform, keyed by the platform string the client sends
-- (`Platform.OS`), so iOS and Android can be at different versions — which they
-- always are around a release, since the two stores never approve together.
--
-- Versions are stored as plain dotted strings ("1.5.0") to match what
-- `expo-application` reports for CFBundleShortVersionString / versionName. They
-- are compared NUMERICALLY, segment by segment, in utils/version.ts — never as
-- text, or "1.10.0" would sort below "1.9.0".
--
-- release_notes is text[] rather than prose so the sheet can render real bullets
-- and stay legible at any length. Empty array = show none; the sheet drops the
-- section rather than printing a heading over nothing.
CREATE TABLE IF NOT EXISTS app_versions_tbl (
  platform              text PRIMARY KEY CHECK (platform IN ('ios', 'android')),
  latest_version        text NOT NULL CHECK (latest_version ~ '^[0-9]+(\.[0-9]+){0,3}$'),
  -- The floor. Anything BELOW this is blocked. Defaults to '0.0.0' — i.e. block
  -- nobody — so a row can be inserted for a release without arming the gate.
  min_supported_version text NOT NULL DEFAULT '0.0.0'
                             CHECK (min_supported_version ~ '^[0-9]+(\.[0-9]+){0,3}$'),
  release_notes         text[] NOT NULL DEFAULT '{}',
  -- Where the "Update" button sends the user. Stored rather than hardcoded so a
  -- store URL change (a new Play listing, a regional App Store path) doesn't
  -- need a client release — which would be the exact problem this table solves.
  store_url             text NOT NULL,
  -- The kill switch for the whole prompt. Set false to stop the app asking
  -- anyone to update — e.g. a release pulled from review after the row was
  -- written. The client treats an inactive row as "you are current".
  is_active             boolean NOT NULL DEFAULT true,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. min_supported_version can never exceed latest_version.
-- ---------------------------------------------------------------------
-- The one edit that bricks the app for EVERY user at once: a floor above the
-- newest build in the store means nobody can satisfy the gate, including people
-- who update immediately. The comparison is on the padded 4-segment integer
-- tuple so it matches the client's ordering exactly rather than sorting as text.
CREATE OR REPLACE FUNCTION version_tuple(v text)
RETURNS int[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    COALESCE((string_to_array(v, '.'))[1]::int, 0),
    COALESCE((string_to_array(v, '.'))[2]::int, 0),
    COALESCE((string_to_array(v, '.'))[3]::int, 0),
    COALESCE((string_to_array(v, '.'))[4]::int, 0)
  ];
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_versions_min_not_above_latest'
      AND conrelid = 'app_versions_tbl'::regclass
  ) THEN
    ALTER TABLE app_versions_tbl
      ADD CONSTRAINT app_versions_min_not_above_latest
      CHECK (version_tuple(min_supported_version) <= version_tuple(latest_version));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. updated_at maintenance.
-- ---------------------------------------------------------------------
-- Not decorative: it is how you tell "the gate is configured correctly" from
-- "the gate has not been touched since three releases ago" when a prompt fails
-- to appear.
CREATE OR REPLACE FUNCTION set_app_versions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS app_versions_set_updated_at ON app_versions_tbl;
CREATE TRIGGER app_versions_set_updated_at
  BEFORE UPDATE ON app_versions_tbl
  FOR EACH ROW EXECUTE FUNCTION set_app_versions_updated_at();

-- ---------------------------------------------------------------------
-- 4. RLS — world-readable, never client-writable.
-- ---------------------------------------------------------------------
-- Readable by `anon` as well as `authenticated`: the check runs on launch, and
-- a signed-out user sitting on a build below the floor still has to be told,
-- otherwise the one screen they can reach is the one that's broken.
--
-- There is deliberately NO insert/update/delete policy. Rows are written from
-- the Supabase dashboard (or by a service-role caller, which bypasses RLS), so
-- a stolen anon key cannot raise min_supported_version and lock every user out
-- of the app — the highest-blast-radius write in this schema.
ALTER TABLE app_versions_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_versions_select_all" ON app_versions_tbl;
CREATE POLICY "app_versions_select_all"
  ON app_versions_tbl FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------
-- 5. Seed — the CURRENT shipped version, not the next one.
-- ---------------------------------------------------------------------
-- Seeding 1.4.0 means the gate exists and is provably wired but prompts nobody
-- until someone bumps it on release day. Seeding 1.5.0 here instead would nag
-- every user for a build that isn't in the store yet.
--
-- ON CONFLICT DO NOTHING so a re-run never rolls back a version bump made in
-- the dashboard.
INSERT INTO app_versions_tbl (platform, latest_version, min_supported_version, release_notes, store_url)
VALUES
  (
    'ios',
    '1.4.0',
    '0.0.0',
    '{}',
    'https://apps.apple.com/ph/app/ambagan-ph/id6779220285'
  ),
  (
    'android',
    '1.4.0',
    '0.0.0',
    '{}',
    'https://play.google.com/store/apps/details?id=com.lhestermonroyo.ambagan'
  )
ON CONFLICT (platform) DO NOTHING;

-- PostgREST caches the schema. Without this the client's first select 404s on a
-- table that demonstrably exists, until the cache happens to roll over.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- RELEASE-DAY USAGE (dashboard SQL editor, once the build is LIVE in the store)
--
--   UPDATE app_versions_tbl
--      SET latest_version = '1.5.0',
--          release_notes  = ARRAY[
--            'Automatic background updates',
--            'Faster group loading'
--          ]
--    WHERE platform = 'ios';
--
-- Run it AFTER the store listing shows the new version, never before: the
-- prompt's Update button deep-links straight to the store page, and a page
-- still showing the old build makes the button a dead end.
--
-- INCIDENT ONLY — force everyone off a broken build:
--
--   UPDATE app_versions_tbl SET min_supported_version = '1.5.1' WHERE platform = 'ios';
--
-- STOP ASKING ALTOGETHER:
--
--   UPDATE app_versions_tbl SET is_active = false WHERE platform = 'ios';
-- ============================================================================
