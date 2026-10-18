# Purchase activation recovery

A completed store purchase and the user-profile update are separate operations.
If saving Pro access fails, the app must recover the purchase instead of asking
the user to pay again.

## Behavior

- Before a purchase, verify that Supabase and RevenueCat refer to the same user.
  Check both pending activation and fresh RevenueCat purchase history before
  opening another store payment dialog.
- Remember the actual store product ID for the `two_week_v1` package. A RevenueCat
  package identifier is not necessarily the store product identifier.
- Preflight local recovery storage before charging. After confirmation, retain
  only the product ID, transaction ID and original purchase date, scoped by user
  and development/release environment. Recovery records survive sign-out/reload.
- Reconcile on purchase, Restore, app launch and reconnect. Two-week pass expiry
  is reconstructed from matching non-subscription transactions in purchase-date
  order. Each unique transaction contributes fourteen days; overlapping pass
  purchases stack, and a purchase after a lapse starts at its own purchase date.
  Replaying history never adds time relative to the restore date.
  Native store IDs and RevenueCat history IDs are kept separate: only canonical
  history receipts enter pass arithmetic. If purchase confirmation arrives before
  that receipt, activation waits for refreshed history instead of counting both IDs.
- The existing saved Pro window is preserved for legacy purchases. A free user's
  stale expiry field alone never grants Pro. Monthly/yearly access continues to
  follow the active Pro entitlement; the later valid access window wins.
- Use a compare-and-set update with a fresh profile read. A concurrent sync cannot
  overwrite a newer paid window. A failed response after a committed update is
  safe to retry with the same target expiry.
- Clear the recovery record only after saving access. Expired receipts are
  reconciled as expired, rather than reviving access or blocking future purchases.
- If a confirmed purchase cannot activate, show “Payment received” and a
  “Retry activation” button. This button refreshes/reconciles purchase status; it
  does not purchase anything. Successful activation still uses the success sheet.
- Update the cached profile after purchase/restore so an offline restart has the
  latest saved access.

RevenueCat documents that custom App User IDs retain consumable history in
[Restoring purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases).
This app already configures RevenueCat with the authenticated user's ID. A new
device resolves pass SKUs from the offering; locally remembered SKUs also support
recovery when the current offering changes.

No new database tables, Edge Functions, secrets or native dependencies are needed.
This extends the existing client-driven plan sync; server-side receipt validation
and webhook handling remain separate work.

## Verification

Run `npm run test:purchase-recovery`. Tests execute the actual service, storage,
expiry calculation and screen handlers with in-memory store/database adapters.
They perform no real purchases or backend writes.

Covered cases include failed activation and full reload, duplicate receipts,
lost write responses, fresh-device restore, expired/stacked passes, legacy access,
monthly entitlement recovery, concurrent writes, storage failure, account changes,
cancellation, Retry activation routing and cached profile updates.

Before release, run a RevenueCat/store sandbox smoke test: purchase a pass,
interrupt the access save, then reconnect or use Retry activation/Restore. Confirm
Pro activates with the original expiry and no second purchase dialog. Also verify
monthly/yearly purchases and user cancellation on the supported platforms.
