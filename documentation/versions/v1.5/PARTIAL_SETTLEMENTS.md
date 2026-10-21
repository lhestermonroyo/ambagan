# Partial settlement payments

Members can submit their full remaining balance or a smaller amount. Recipients
can mark original full payments received, confirm or reject an individual request,
and reopen an individual confirmed payment. Senders can withdraw requests.
This is available on both Free and Pro and records transfers arranged outside
Ambagan; it does not initiate a bank transfer.

## Rollout

The hosted database has **not** been migrated by this change.

1. Run `migrations/2026-10-19_partial_settlement_payments.sql` in the Supabase SQL
   editor with its default `SET LOCAL search_path = dev, extensions, pg_temp;` line.
2. Run `migrations/2026-10-19_partial_settlement_receiver_permissions.sql` afterward
   if the earlier version of the first migration was already applied. The updated
   first migration also includes these guards for fresh installations. This
   follow-up defaults to `dev`; change its search path explicitly for public too.
   Test two real development accounts, including proof uploads and notifications.
3. Coordinate the release/minimum-supported-build setting before migrating
   public. Old builds directly overwrite settlement status; the migration
   deliberately rejects those writes so they cannot erase partial-payment
   history or incorrectly settle an original full amount.
4. For production, run the same SQL with only that line changed to
   `SET LOCAL search_path = public, extensions, pg_temp;`.

No Edge Function deployment is needed. Development still uses `dev` and release
builds still use `public`; no backend-routing overrides were added.

The migration runs in one transaction, pins helper/RPC search paths to the
selected schema, adds read RLS and authenticated RPC grants, and can be rerun.
Existing requested, settled, or rejected snapshots become one payment each,
retaining their available notes/proof. Previously overwritten payments cannot
be reconstructed. Existing fully settled balances stay fully paid.

## Balances and permissions

- The original settlement amount never changes. Remaining balance is the
  original amount minus confirmed payments, rounded to cents for display.
- Requested, rejected, and withdrawn amounts do not reduce balances.
- Parent statuses remain `pending`, `requested`, and `settled` so existing
  filters, reminders, and group/member deletion checks continue to work.
  Pending items with confirmed amounts display **Partially paid**. An outstanding
  request takes the status badge while confirmed progress remains visible.
- There can be one requested payment per settlement. It must be resolved before
  another request, direct received payment, or reopening another payment.
- Only the sender requests/withdraws partial or remaining payments; the recipient
  confirms, rejects, or reopens them. Direct Mark Settled is restricted to full
  payments on settlements with no partial-payment history. These restrictions
  apply to RPCs and bulk settlement as well as the UI. Group members/owner may read history. The ledger cannot
  be mutated directly by app clients.
- Reopening changes that payment back to requested and restores its amount to
  the remaining balance. Original notes, proof, and lifecycle dates remain.
- Amounts must be positive with at most two decimals. Full payments must match
  the current remaining amount; partial payments must be smaller. Stale amounts
  are rejected and the form refreshes.
- Both write RPCs lock the expense before the settlement. This serializes
  sibling confirmations and keeps expense completion/reopening in the same
  transaction as the payment. Stable payment IDs prevent duplicate retries;
  repeated successful transitions do not create another notification.
- Expenses with payment history cannot be re-split or removed through ordinary
  expense editing, including when their only history is rejected/withdrawn.
  Fully settled group cleanup removes settlement parents before split children.

## App flow

All settlement forms and review screens open the root `/settlement` native
`fullScreenModal` route. It uses the same native presentation system as the
feature tour, with fullscreen safe-area spacing, keyboard avoidance, and a
sticky footer. Home, Friends, and Groups share this route; there is no nested
Actionsheet for the settlement itself. A session-local presentation request
retains the preview and source-list callbacks without serializing them into
navigation params. Dismissal clears that request and the source selection;
cold-restored routes without a request return safely to the app. Saving blocks
native dismissal, and success feedback waits until the settlement route leaves.
An overlay host inside the native route keeps confirmation sheets (including
Withdraw Request, Reject, and Reopen Payment) and proof-picker sheets above the
settlement instead of behind its native modal.
**Pay in Full** stays selected by default and keeps the original titles and actions:
Request as Settled / Request Settled for the sender, Mark as Settled / Mark
Settled for the recipient, and Review Settlement with its date, participant,
note, and proof cards. Full requests keep Approve/Reject and Undo Request;
confirmed full payments keep Revert for the recipient.

Only the sender sees the payment-mode tabs. Choosing **Pay Partially** switches to the partial form within the fullscreen
sheet. Settlements that have used a partial amount open **Settlement Details**.
Their pending payment opens
expanded for review; the other entries are collapsible, one open at a time.
The persisted `has_partial_payments` flag keeps this flow after final payment.
Full-amount rejection/retry/revert history alone does not activate it. Rerun the
migration if an earlier version was already applied; the flag is backfilled
from existing ledger rows without duplicating payments.

**Pay Remaining** (sender only) slides left to **Record Payment** inside the same
mounted fullscreen sheet, with the remaining balance and optional note/proof. The button sits
above Payment history; a themed alert replaces it while a request awaits
confirmation and explains the next step. Back slides right to details and
preserves the draft. Recipients review requests in history and cannot create
partial or remaining payment entries.
Fresh details/ledger load in one database snapshot; actions remain blocked
while loading, on read failure, or if history is incomplete. Offline users
retain cached list balances, but loading details and submitting payments need
a connection. Failed submissions keep the draft and retry ID.

Home, group/friend balances, all three settlement row views, grouped totals,
notification badges, and editing guards use confirmed progress. Friend bulk
actions use the same ledger transactionally. **Settle All** excludes settlements
with partial history; recipients review those requests individually. A stale row
rolls the entire batch back. Home merges recently created settlements and recently
updated payments so partial progress on older expenses appears in Recent Settlements.

CSV export includes one row per payment with original debt, confirmed total,
remaining balance, individual amount/status/dates/notes/proof. Settlement totals
repeat across payment rows; group by Settlement ID when aggregating them.

Full requests and approvals keep their existing feedback sheets. Full
rejection, Undo Request, and Revert keep their original success toasts; full-only
friend bulk actions also keep their success toasts. Partial confirmations,
rejection, withdrawal, and reopening use feedback sheets with the outlined Close
button and themed circle. Errors retain toasts. In-app notifications are
written transactionally; individual-payment push delivery is best effort.

New artwork and exact built-in imagegen prompts are recorded in
`PARTIAL_SETTLEMENT_ILLUSTRATIONS.md`. Existing full-settlement/requested artwork
is reused where it fits.

## Validation

`npm run test:settlement-payments` runs the actual migration/RPCs in PostgreSQL
through the PGlite development dependency and the actual TypeScript client logic
with native/network adapters. It covers amounts, authorization/RLS, idempotency,
legacy backfill, note/proof preservation, remaining balances, bulk rollback,
expense completion, reopening, schema isolation, loading races, draft recovery,
and CSV rows. No hosted data is used. PGlite serializes its local queries; run
real simultaneous submissions from two development clients before production
to validate hosted multi-session behavior and existing schema-specific policies.

Also verified: iOS Expo export/React Compiler compilation. Native device
interaction and hosted storage/push delivery still require the development
migration and real signed-in accounts.

Suggested two-account check: on a 1,000 balance, confirm 300, request 200, verify
700 remains until confirmation, then verify 500 remains. Reject/withdraw a new
request and check the balance stays 500. Reopen the confirmed 200 and check 700
remains. Confirm again, finish the remaining 500, then check the expense is
complete and all views agree. Repeat with proof uploads and a retry after
temporarily losing connectivity.
