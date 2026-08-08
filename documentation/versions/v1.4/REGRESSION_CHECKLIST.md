# Ambagan PH — Regression Testing Checklist

> Manual regression pass covering features and microfeatures. Run before each
> release (current: **v1.4**). Test on both **iOS** and **Android**, and where
> noted, in **online** and **offline** states.
>
> Legend: `[ ]` = to test · `[x]` = passed · `[!]` = failed / needs follow-up

---

## 1. Auth & Onboarding

### Sign up
- [ ] Sign up with email + password succeeds
- [ ] Sign up with phone number (normalized to E.164) succeeds
- [ ] Duplicate email/phone is rejected with a clear error
- [ ] Weak / invalid password is rejected
- [ ] Onboarding flow runs after first sign up (name → phone → avatar)

### Login
- [ ] Login with email + password
- [ ] Login with phone number (resolves to email)
- [ ] Wrong credentials show an error, no crash
- [ ] Session persists across app restart (stays logged in)
- [ ] Auth state hydrates on cold start without a flash of the login screen

### Password reset
- [ ] Forgot password sends reset email
- [ ] Reset-password deep link opens the app to the reset screen
- [ ] Setting a new password works and lets you log in with it

### Logout & account
- [ ] Logout clears session and returns to welcome/login
- [ ] Delete account removes data and signs out
- [ ] Onboarding avatar upload (skip + upload paths)

---

## 2. Groups

### Create / edit
- [ ] Create group (name, members, currency default)
- [ ] Add members from contacts (ContactPickerSheet)
- [ ] Add members manually / by selection
- [ ] Edit group details (name, members)
- [ ] Edit member (EditMemberSheet)
- [ ] Free-tier limit on active admin groups is enforced (Pro gating)

### Lifecycle
- [ ] Archive group → moves out of active list
- [ ] Unarchive group → returns to active list
- [ ] Leave group (non-admin)
- [ ] Delete group (admin) with confirmation sheet
- [ ] Group stats tab renders correct totals
- [ ] Group details tab renders members + balances

### Invite / join
- [ ] Generate/share invite link
- [ ] Reset group invite token invalidates old link
- [ ] Link expiration setting (LinkExpirationSheet)
- [ ] Join group by token via deep link (`/join/[token]`)
- [ ] QR scan-to-join (`app/scan.tsx`) opens correct group
- [ ] Joining an expired / invalid link shows a clear error

---

## 3. Expenses

### Add expense (single unified form — `add-expense.tsx`)
- [ ] Enter title, amount, date, category
- [ ] Paid-by sheet: single payer
- [ ] Paid-by sheet: multiple payers with contributions (sums validate)
- [ ] Split sheet: equal split
- [ ] Split sheet: custom split (amounts sum to total)
- [ ] Solo-expense guard in Edit Split sheet behaves correctly
- [ ] Attach receipt image (proof)
- [ ] Save expense reflects immediately in group + balances
- [ ] Free-tier daily expense limit enforced; Pro removes it

### Edit / delete
- [ ] Edit existing expense (all fields persist)
- [ ] Delete expense updates balances and settlements
- [ ] Editing an expense that is mid-settlement is blocked (`SETTLEMENT_IN_PROGRESS`)

### Drafts
- [ ] Save draft expense
- [ ] Resume + finalize draft
- [ ] Draft does not affect balances until finalized

### Recurring expenses (Pro — `recurring_expenses_tbl` + `run-recurring` Edge Function)
- [ ] Free user: **Repeat** row opens the Upgrade sheet; no series created
- [ ] Pro user: set a monthly series with a custom split → first occurrence posts immediately + affects balances
- [ ] "Save Recurring" disabled until amount/payers/split are valid (same as a one-off)
- [ ] Recurrence summary + next-run date shown on the group ⋯ → Recurring Expenses screen
- [ ] Pause skips generation on the next cron run; resume generates again
- [ ] End condition (on date / after N times) auto-pauses the series
- [ ] Delete series stops future occurrences; already-posted ones remain
- [ ] Member leaves group → equal split recomputes; invalid custom/percentage split posts as a draft + notifies creator only
- [ ] Overlapping/duplicate cron runs don't double-post (unique `(recurring_id, expense_date)`)
- [ ] Creator downgraded from Pro → series is skipped (not deleted) and resumes on re-subscribe
- [ ] Involved members receive the `EXPENSE_INCLUSION` push when an occurrence posts
- [ ] Recurring can't be created offline (toast prompts to reconnect)

### Scan receipt (Beta — OCR)
- [ ] Scan receipt autofills title/amount (`scan-receipt` Edge Function)
- [ ] Manual correction of scanned fields works
- [ ] Graceful fallback when OCR fails / low confidence
- [ ] Permission denied for camera handled gracefully

---

## 4. Settlements

- [ ] Settlement breakdown shows correct who-owes-whom amounts
- [ ] Request settlement (createSettledRequest)
- [ ] Undo a settlement request
- [ ] Reject a settlement request (as payee)
- [ ] Revert a rejected/settled request
- [ ] Mark as settled (markAsSettled) updates both sides
- [ ] Review request-paid sheet flow
- [ ] Settlement view preference (per-group / per-friend) respected
- [ ] Net balance cards show correct signed totals
- [ ] Export settlements to CSV (ExportCsvSheet) with date range

---

## 5. Multi-currency (Pro)

- [ ] Free tier is locked to PHP (CurrencySelection `locked`)
- [ ] Pro user can pick per-expense currency (PHP/JPY/SGD)
- [ ] Currency amount displays with correct symbol/format
- [ ] Currency breakdown sheet totals per currency
- [ ] Mixed-currency group does not cross-sum different currencies

---

## 6. Friends

- [ ] Friends list loads and auto-saves people from shared groups
- [ ] Friend detail screen shows shared groups + net balance
- [ ] Favorite / unfavorite a friend (FavoritesSheet, useFavoriteToggle)
- [ ] Friend settlement route from notification lands correctly

---

## 7. Notifications

- [ ] Notification list loads and marks as read
- [ ] Push notification received (via send-push Edge Function)
- [ ] Notification grouping displays correctly
- [ ] Tapping a notification deep-links to the right screen
- [ ] Push token registered on login / permission grant
- [ ] Push permission sheet (grant + deny paths)
- [ ] Daily reminder notification fires

---

## 8. Subscription (RevenueCat)

- [ ] Paywall / UpgradeSheet displays offerings (2-week ₱99 · monthly ₱149 · yearly ₱799)
- [ ] Purchase flow completes (sandbox/TestFlight)
- [ ] "Ambagan Pro" entitlement unlocks Pro features
- [ ] Restore purchases works
- [ ] Pro badge shows for subscribed users
- [ ] Downgrade/expiry re-locks Pro features (currency, limits)

---

## 9. Profile & Settings

- [ ] Edit personal info (name, phone)
- [ ] Upload / change avatar
- [ ] Appearance / theme setting (AppearanceSheet)
- [ ] Push notification settings toggle
- [ ] Settlement view preference sheet
- [ ] Account settings screen
- [ ] Analytics screen renders charts/stats
- [ ] Help center: FAQ search + questions
- [ ] About screen

---

## 10. Offline & Sync

> Test with device airplane mode / network off.

- [ ] Offline banner appears when connection drops
- [ ] Slow-connection banner appears on degraded network (useNetworkHealth)
- [ ] Banner pushes navigation headers + full-height sheets down correctly
- [ ] Cached groups/expenses viewable offline (SQLite stale cache)
- [ ] Create expense offline → queued (pending_queue) with "Syncing…" badge
- [ ] Reconnect flushes the queue (useOfflineSync) and clears badges
- [ ] Offline daily-limit enforcement still applies
- [ ] No duplicate writes after reconnect
- [ ] Banner clears when back online

---

## 11. Cross-cutting / Platform

- [ ] iOS 26 native glass tabs (NativeTabs) render + navigate
- [ ] Native Stack toolbar headers show all actions (arrays, not fragments)
- [ ] Deep links / universal links resolve when app is cold vs. backgrounded
- [ ] Pull-to-refresh on key lists
- [ ] Empty states render (no groups / no expenses / no friends)
- [ ] Skeleton loaders show during fetch
- [ ] RLS: user cannot read/write another user's data
- [ ] App handles session expiry / token refresh mid-use
- [ ] Light and dark mode across all major screens

---

_Last updated for release v1.3 — keep in sync with new features as they ship._

---

## 12. Books & personal expenses (new in v1.4)

### Books
- [ ] Books tab lists books; create a book (name, category, avatar, currency)
- [ ] Edit a book; archive and unarchive; delete a book
- [ ] Book detail shows Paid / Pending totals per currency

### Personal expenses
- [ ] Add, edit, and delete a personal expense in a book
- [ ] Toggle an expense between Paid and Pending; totals move between buckets
- [ ] Filter the ledger by status (All / Pending / Paid) and by category
- [ ] Free account hits the 5 personal expenses/day cap, counted **separately** from the group cap

### Budgets
- [ ] Set a budget with period Every month; bar fills with paid, pending stacks at lower opacity
- [ ] Set a budget with period Whole book; over-budget state renders in the error colour
- [ ] Clear the budget (blank amount) and the bar disappears
- [ ] Mixed-currency book folds foreign spend in, headlines with `≈`, and shows the rate date from `fx_rates_tbl` (NOT the shipped 2026-08-01 fallback)

### Book currencies (Pro)
- [ ] Book currency PHP + Default for new expenses JPY → Add Expense opens on JPY, totals headline in PHP
- [ ] Editing the book currency leaves a pinned entry default alone, but a "Same as book currency" book follows
- [ ] Free account does not see the second currency field

### Personal recurring (Pro)
- [ ] Create a template; `next_run_at` is set; the hourly cron materializes exactly one expense
- [ ] Two consecutive cron runs do NOT double-post the same period
- [ ] Pause, resume, and delete a template

### Book ↔ group link
- [ ] Link a book to a group from the group Stats tab; combined "cost me" total is right
- [ ] Only one linked book per user per group is allowed
- [ ] Linking to a group you are not a member of is rejected

### Offline
- [ ] Create, edit, delete a book and a personal expense in airplane mode → "Syncing…" badge → flushes on reconnect
- [ ] Toggling paid/pending offline queues and replays correctly

## 13. Home & cross-cutting (new in v1.4)

- [ ] Personal Spending card renders on Home and taps through to Books
- [ ] Profile → Overview Hero → Personal Spending; force-quit and relaunch opens on that page with no visible slide
- [ ] Group currency (Pro) can be set; free account is locked to PHP; existing groups still read PHP
- [ ] Scan a receipt into a group AND into a book via the destination picker (with search)
- [ ] Recurring notification arrives once per template per run, renders with the repeat glyph and no "<your name>" prefix, and deep-links correctly
- [ ] Toggling Push Notifications → Recurring Expenses off suppresses the push but still writes the in-app row
- [ ] Analytics Groups / Personal / All scope filter
- [ ] Feature tour shows on first launch and can be skipped
