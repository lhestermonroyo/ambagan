-- ============================================================================
-- Settlement lifecycle timestamps
--
-- payment_splits_tbl previously tracked a single `status_updated_at` that every
-- transition overwrote — so a settled split lost its request date, and a
-- rejection (which reverts status to 'pending') left no trace at all.
--
-- Split it into dedicated nullable timestamps so the settlement sheets can show
-- Request Date / Mark Settled Date / Rejection Date independently. `rejected_at`
-- deliberately persists after the split reverts to 'pending' and is cleared on
-- re-request (see createSettledRequest).
--
-- Safe to run more than once (IF NOT EXISTS + IS NULL guards).
-- ============================================================================

ALTER TABLE public.payment_splits_tbl
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS settled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at  timestamptz;

-- Backfill existing rows from the old single status_updated_at so history shows.
UPDATE public.payment_splits_tbl
  SET requested_at = COALESCE(status_updated_at, created_at)
  WHERE status = 'requested' AND requested_at IS NULL;

UPDATE public.payment_splits_tbl
  SET settled_at = COALESCE(status_updated_at, created_at)
  WHERE status = 'settled' AND settled_at IS NULL;
