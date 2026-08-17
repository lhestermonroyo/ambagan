-- ============================================================================
-- Group-level currency — per-group "home currency"
--
-- Multi-currency is a travel feature: a Pro user can run a JPY "Japan Trip"
-- group and a PHP "Daily" group at the same time. Books already have their own
-- `currency` (each ledger's home currency); this brings groups to parity.
--
-- What the column drives, mirroring books:
--   * INPUT DEFAULT   — new expenses in the group seed to this currency (still
--                       changeable per expense).
--   * PRIMARY DISPLAY — the group's own net-balance hero + Stats tab surface
--                       this currency first (a JPY group must not filter its
--                       stats to the user's PHP default and come up empty).
--
-- Free tier stays PHP-only, so existing/free groups are simply 'PHP'. The
-- app-level Pro gate on the picker keeps free groups pinned to PHP.
--
-- ----------------------------------------------------------------------------
-- DEV / PROD — same one-project, schema-split setup as the other migrations.
-- Identifiers are UNQUALIFIED and resolved via search_path, so the SET line
-- below picks the target schema.
--
-- >>> ROLLOUT ORDER (dev first, prod at release): <<<
--   * NOW — apply to DEV:         keep `SET search_path = dev, public, extensions;`
--   * AT RELEASE — apply to PROD:  change it to `SET search_path = public, extensions;`
--
-- Idempotent (IF NOT EXISTS), safe to run more than once and against each
-- schema in turn.
-- ============================================================================

SET search_path = dev, public, extensions;   -- PROD (at release): public, extensions

-- ---------------------------------------------------------------------
-- currency column — NOT NULL, defaults to 'PHP' so every existing row
-- (and any insert that omits it) is a valid single-currency PHP group.
-- ---------------------------------------------------------------------
ALTER TABLE groups_tbl
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PHP';
