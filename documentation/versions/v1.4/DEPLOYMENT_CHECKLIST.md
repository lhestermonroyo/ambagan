# Deployment Checklist — v1.4

Everything applied to **dev** during v1.4 development that is **not in prod yet**.
Work top-to-bottom on release day, then tick the boxes.

**Context — one project, two schemas.** Dev and prod share the single Supabase
project `zwlzyvvhgfmffjzzvrjx`. Environments are split by Postgres schema
(`dev` = dev builds, `public` = prod) and by Edge Function name suffix
(`<name>-dev` = dev, `<name>` = prod). `__DEV__` picks both at runtime
(`utils/supabase.ts`). So every DB change has to be run **twice**, once per
schema — during development only the `dev` half was run. This file is the
`public` half.

> ⚠️ Anything below marked **(verify)** could not be confirmed from the repo —
> the Supabase CLI isn't linked locally. Check it in the dashboard rather than
> assuming.

---

## A. Database migrations → `public` schema

All migration files live in [migrations/](../../../migrations/). They are written
schema-agnostic: identifiers are **unqualified** and resolved via `search_path`,
so you target prod by editing the single `SET` line at the top before pasting
into the Supabase SQL editor:

```sql
-- change this (dev, the committed default):
SET search_path = dev, public, extensions;
-- to this (prod):
SET search_path = public, extensions;
```

All of them are idempotent (`IF [NOT] EXISTS` / `CREATE OR REPLACE` /
`DROP … IF EXISTS`), so a re-run is safe.

**Run in this order:**

- [ ] **1. [`2026-07-28_personal_books_v1.sql`](../../../migrations/2026-07-28_personal_books_v1.sql)** — the personal "Books" feature, whole thing.
  - Creates `personal_books_tbl`, `personal_expenses_tbl`, `personal_recurring_tbl`, `personal_expense_creation_log_tbl`.
  - Creates the `log_personal_expense_creation()` trigger (free-tier 5/day meter — a **separate bucket** from the group `expense_creation_log_tbl`).
  - Enables RLS + 4 owner-only policies (`user_id = auth.uid()`), grants to `authenticated`.
  - Drops the abandoned pre-pivot artifacts: `user_preferences_tbl.app_mode`, `user_preferences_tbl.monthly_budget`, the 2-book-limit trigger/function. In prod these never existed → the `DROP … IF EXISTS` calls are no-ops.
  - **This file supersedes `2026-07-25_personal_expenses.sql` and `2026-07-27_personal_book_group_link.sql` — do NOT run those against prod.** They were the pre-pivot design (global `app_mode` toggle, 2-book free cap, group-linked books) and were only ever applied to `dev`. The v1 file is self-contained and reaches the same end state from a fresh schema.

- [ ] **2. [`2026-07-31_personal_recurring.sql`](../../../migrations/2026-07-31_personal_recurring.sql)** — activates personal recurring (Pro). Depends on step 1.
  - Indexes `personal_recurring_due_idx` (generator hot path) + `personal_recurring_book_idx`.
  - `touch_personal_recurring_updated_at()` + its trigger.
  - `personal_expenses_recurring_period_uidx` on `(recurring_id, expense_date)` — the double-post backstop. **Required before the prod `run-recurring` deploy in section B**, otherwise overlapping cron runs can materialize a period twice.

- [ ] **3. [`2026-07-31_group_currency.sql`](../../../migrations/2026-07-31_group_currency.sql)** — group-level home currency.
  - `ALTER TABLE groups_tbl ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PHP'` — existing prod groups all become PHP, which is correct (free tier is PHP-only; the picker is Pro-gated in the app).

- [ ] **4. [`2026-07-27-category-default-general.sql`](../../../migrations/2026-07-27-category-default-general.sql)** — category defaults `'other'` → `'general'`.
  - ⚠️ **Unlike the others, this file is schema-qualified** (it names `dev.*` and `public.*` explicitly) and its `public.*` half touches `public.personal_books_tbl` / `personal_expenses_tbl` / `personal_recurring_tbl`. It therefore **must run after step 1** or it errors on the missing tables. **(verify)** whether its `public` half was already run — if it was, it failed partway on the personal tables and the `groups_tbl` / `expenses_tbl` / `recurring_expenses_tbl` defaults may or may not have landed. Re-running is harmless (it just re-sets the same defaults).
  - DEFAULT only — it does not rewrite existing rows.

- [ ] **5. [`2026-08-01_book_budget.sql`](../../../migrations/2026-08-01_book_budget.sql)** — per-book budgets (free for all users). Depends on step 1.
  - `ALTER TABLE personal_books_tbl ADD COLUMN IF NOT EXISTS budget_period text NOT NULL DEFAULT 'monthly'` + a CHECK for `('monthly','total')`. Existing rows all have `budget IS NULL`, so the default is inert and no backfill is needed.
  - Adds `personal_books_budget_positive_chk` → `budget IS NULL OR budget > 0`, making NULL the only way to express "no budget".
  - The `budget` column itself already ships in step 1 — this file only adds the period and the checks.
  - Ends with `NOTIFY pgrst, 'reload schema';`. Without it the app hits **PGRST204 "Could not find the 'budget_period' column … in the schema cache"** on book create until PostgREST catches up on its own. (Exactly what happened on dev.)
  - Applied to `dev` 2026-08-01.

- [ ] **6. [`2026-08-01_fx_rates.sql`](../../../migrations/2026-08-01_fx_rates.sql)** — `fx_rates_tbl`, the indicative FX rates behind the budget card's mixed-currency bar. Independent of the other migrations (no FKs, no dependencies) — order doesn't matter.
  - Creates the table + RLS (`SELECT` for `authenticated`, and **deliberately no write policy at all** — only the service role writes, so a leaked anon key can't poison rates) + seeds 14 currencies from a real 2026-08-01 feed snapshot.
  - `ON CONFLICT DO NOTHING` on the seed, so re-running never clobbers a fresher rate the cron has written.
  - Pairs with the `refresh-fx-rates` function (§B) and its cron (§C). **All three are needed** — the table alone just serves the ageing seed.
  - Applied to `dev` 2026-08-01.

- [ ] **7. [`2026-08-01_fx_refresh_log.sql`](../../../migrations/2026-08-01_fx_refresh_log.sql)** — `fx_refresh_log_tbl`, one row per `refresh-fx-rates` run. Depends on nothing; deploy the function (§B) after it so the first run can log.
  - RLS enabled with **no policies at all** — the app never reads it and the function writes as the service role, so an empty policy set means no client key can see it.
  - Exists because the refresh otherwise fails silently: `cron.job_run_details` only reports whether the SQL ran, `net._http_response` is pruned within hours, and the app degrades quietly to stale rates.
  - Health check: `select max(ran_at) from fx_refresh_log_tbl where ok;`
  - The function prunes rows past 180 days, so it stays a few dozen rows.

- [ ] **8. [`2026-08-02_hero_view_preference.sql`](../../../migrations/2026-08-02_hero_view_preference.sql)** — `user_preferences_tbl.hero_view`, which page the Overview's hero pager opens on. Independent of the other migrations — order doesn't matter.
  - `ADD COLUMN IF NOT EXISTS hero_view text NOT NULL DEFAULT 'balance'` + a CHECK for `('balance','personal')`. Existing rows all take the default, which is today's behaviour, so no backfill is needed and an app rollback is inert.
  - Ends with `NOTIFY pgrst, 'reload schema';` — without it the first preference write hits **PGRST204 "Could not find the 'hero_view' column … in the schema cache"**.
  - The app normalizes any unrecognised value back to `'balance'` (`user.state.ts`), so the CHECK is a backstop rather than the only guard.

- [ ] **9. [`2026-08-02_book_group_link.sql`](../../../migrations/2026-08-02_book_group_link.sql)** — activates the book↔group roll-up ("what did this trip cost me"). Depends on step 1, which created `personal_books_tbl.group_id` but left it unused.
  - Adds the partial unique index `personal_books_user_group_uniq (user_id, group_id) WHERE group_id IS NOT NULL` — one linked book per user per group — and the `enforce_book_group_membership` BEFORE INSERT/UPDATE trigger.
  - The trigger resolves `group_members_tbl` from **`TG_TABLE_SCHEMA`**, *not* via `public.is_group_member()`. That helper is `SET search_path = public`, so in the `dev` schema it would check prod membership; the same reasoning as `log_personal_expense_creation()` in step 1. Nothing to change when targeting prod — it resolves to `public` there on its own.
  - No RLS changes. `personal_books_owner` staying owner-only is what keeps the personal half of the roll-up private from other group members; do not relax it.
  - No backfill: every existing book has `group_id IS NULL` and is unaffected. An app rollback is inert — the column simply goes unread again.
  - **(verify)** after applying, run `NOTIFY pgrst, 'reload schema';` — the book queries now embed `groups_tbl` via the `personal_books_tbl_group_id_fkey` hint, and a stale schema cache surfaces as **PGRST200** on every book fetch.

- [ ] **10. [`2026-08-02_recurring_notifications.sql`](../../../migrations/2026-08-02_recurring_notifications.sql)** — `user_preferences_tbl.notif_recurring_expense`, the push toggle for the new recurring notifications. Independent of the other migrations — order doesn't matter, but it must land **before** the `run-recurring` deploy in §B.
  - `ADD COLUMN IF NOT EXISTS notif_recurring_expense boolean NOT NULL DEFAULT true`. Existing rows take the default (opt-out, like every other `notif_*` column), so no backfill.
  - `notifications_tbl.type` is plain `text` with no CHECK, so the two new type values (`recurring_posted`, `recurring_review`) need no DDL.
  - Ends with `NOTIFY pgrst, 'reload schema';`. This one matters more than usual: until the cache refreshes, the Edge Function's `select('notif_recurring_expense')` fails, which the code reads as "pref off" and **silently drops every recurring push**.
  - Applied to `dev` 2026-08-03.

- [ ] **11. [`2026-08-04_book_default_expense_currency.sql`](../../../migrations/2026-08-04_book_default_expense_currency.sql)** — `personal_books_tbl.default_expense_currency`, splitting the book's one currency into its two jobs. Depends on step 1.
  - `ADD COLUMN IF NOT EXISTS default_expense_currency text` — **nullable with no DEFAULT**, because NULL is a meaningful value here ("follow the book's `currency`") rather than a missing one. A default that copied the book's currency would freeze a snapshot that then drifts when `currency` is edited.
  - `currency` keeps its existing meaning (budget cap, budget bar, Paid/Pending card, Stats gauge, group roll-up all convert **into** it). The new column feeds **only** what Add Expense / Scan / the recurring template prefill.
  - Adds `personal_books_default_expense_currency_chk` → `NULL OR ~ '^[A-Z]{3}$'`. A shape check, not an enum, so adding a currency to the app never needs a migration.
  - No backfill: every existing row stays NULL, which is exactly the pre-migration behaviour. An app rollback is inert — the column simply goes unread.
  - Ends with `NOTIFY pgrst, 'reload schema';`. Without it, book create/update hits **PGRST204 "Could not find the 'default_expense_currency' column … in the schema cache"**, and `BOOK_SELECT` (which now names the column) fails on **every** book read — so this one breaks the Books tab outright, not just writes.
  - ⚠️ **Not yet applied to `dev`.** Run it there (the file's `search_path` already targets `dev`) before testing the Books tab on a dev build.

- [ ] **12. (verify) FK sanity.** The new personal tables are created with unqualified `REFERENCES`, so prod gets `public → public` FKs naturally. No [`scripts/sync-dev-fks.sql`](../../../scripts/sync-dev-fks.sql) pass is needed for prod. If a nested `.select()` embed 404s with `PGRST200` after the migration, run `NOTIFY pgrst, 'reload schema';`.

> [`db.dev.sql`](../../../db.dev.sql) at the repo root is a **reference dump of the
> `dev` schema, not runnable** (its own header says so). Use it to diff the
> expected end state against prod after the migrations, not as a migration.

---

## B. Edge Functions → prod

Deploy with the per-env script (it prompts before touching prod):

```bash
scripts/deploy-functions.sh prod --dry-run   # see the plan first
scripts/deploy-functions.sh prod             # all prod functions
scripts/deploy-functions.sh prod run-recurring
```

- [ ] **`run-recurring`** — **required for v1.4.** Rewritten to process **two** template kinds per invocation: group (`recurring_expenses_tbl` → `expenses_tbl` + payers + splits + notifications) and personal (`personal_recurring_tbl` → `personal_expenses_tbl`, a single insert per period, no splits). Adds `generatePersonalOccurrence`, `processPersonalTemplate`, and `isCreatorPro` (lapsed Pro creators are **skipped, not deleted**, so a series resumes on renewal). Deploy **after** migration A2 lands the unique index.
  - Also raises the new **recurring notifications**: `recurring_posted` to the creator/owner for both group and book, and `recurring_review` (replacing the mis-typed `expense_inclusion` the draft case borrowed) when a group occurrence degrades to a draft. Both are aggregated to **one notification per template per run**, so a catch-up over many periods can't fire dozens of pushes. Deploy **after** migration A10, or the pref lookup fails and every recurring push is dropped — the in-app rows still get written, so it reads as "push is broken" rather than a schema problem. `run-recurring-dev` is already deployed on dev (2026-08-03) and **verified end-to-end there**: book `recurring_posted`, group `recurring_posted` (+ `expense_inclusion` to the other members, creator correctly excluded), and the degraded-draft `recurring_review`. Seed/fire/inspect/cleanup SQL is in [`scripts/test-recurring-notifications.sql`](../../../scripts/test-recurring-notifications.sql) — the same script works against prod by swapping the search_path and the function URL.
- [ ] **`send-push`** — **now a real change, not just parity:** its `NOTIF_PREF_KEY` map gains `recurring_posted` / `recurring_review` → `notif_recurring_expense`. Prod is also still running the pre-refactor code (`_shared/*.ts` + thin `index.ts` entrypoints), which this deploy picks up.
- [ ] **`refresh-fx-rates`** — **new in v1.4.** Weekly refresh of `fx_rates_tbl` from `open.er-api.com` (no API key). Deploy **after** migration A6 creates the table. Needs no new secrets — `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected. `refresh-fx-rates-dev` is already deployed and cronned on dev.
- [ ] **`scan-receipt`** — same parity note. **(verify)** that prod is on the Claude Haiku 4.5 implementation (it was swapped from Gemini) and not stale — v1.4 adds scan-receipt to the books/personal flow, so prod needs the current handler.

---

## C. Cron & secrets

- [ ] **No new cron job is needed for personal recurring.** The existing prod `run-recurring` hourly job (:00) drives both group and personal templates in the same invocation. The dev job (`run-recurring-dev-hourly`, :30) is already live and stays as-is.
- [ ] **One NEW cron job is needed: `refresh-fx-rates-weekly`.** Mondays 03:10 UTC (11:10 Manila), hitting the **non-suffixed** prod function URL. Weekly is deliberate — it drives an approximate budget indicator, not a settlement, and the function is idempotent so a missed week is a no-op. Ready-to-paste SQL is in the migration's trailing comment block (fill in the project ref).
  - **Invoke it once by hand before scheduling.** `pg_net` is async, so the real HTTP status lands in `net._http_response`, **not** in `cron.job_run_details` — a job that 401s on the Vault key reports `succeeded` every week and fails silently. Want `200 {"ok":true,"updated":14}`.
  - Sharpest post-deploy check: if `fx_rates_tbl.as_of` still reads the seed date `2026-08-01`, the function has never successfully written.
  - After the first run, confirm the log caught it: `select ran_at, ok, status, updated_count, rejected from fx_refresh_log_tbl order by ran_at desc limit 5;` — expect `ok = true`, `status = 'ok'`, `updated_count = 14`. From then on, `select max(ran_at) from fx_refresh_log_tbl where ok;` is the one-query health check.
- [ ] **(verify) Vault `service_role_key`.** The prod cron authenticates with the Vault secret and it **must hold the new `sb_secret_…` key, not the legacy `eyJ…` JWT** — the legacy one returns 401. If the key was rolled at any point during v1.4, re-set it. Confirm by checking the last `cron.job_run_details` rows return 200.
- [ ] **(verify) `ANTHROPIC_API_KEY`.** Supabase function secrets are project-level, so prod and dev share it — if scan-receipt works in dev it's set. Confirm it's still present before relying on prod scan.

---

## D. Storage & project settings — no action expected

- [ ] **No new prod buckets.** `avatars` / `receipts` / `group_covers` already exist in prod. Only the `-dev` mirrors were created during development (`utils/upload.ts` routes `__DEV__` uploads to `<bucket>-dev`). Book/personal receipts reuse the existing `receipts` bucket.
- [ ] **Exposed schemas** — `dev` was added to Settings → API for dev builds. `public` was always exposed. Nothing to change.
- [ ] **RevenueCat** — no new products or entitlements in v1.4. The new Pro surfaces (personal recurring, group currency picker) gate on the existing **"Ambagan Pro"** entitlement.

---

## E. App build & release

- [ ] **Bump the version.** [`app.json`](../../../app.json#L5) is still `"version": "1.3.0"` → set `1.4.0` and bump the iOS build number.
- [ ] **A native rebuild is required — this cannot ship as an OTA update.** v1.4 adds **`@expo/ui` (~56.0.24)** as a dependency (used by the new `AppDatePicker` / `DatePickerModal` native pickers). New native module ⇒ new binary.
- [ ] Commit the still-uncommitted v1.4 work before building — as of writing, the personal-recurring feature is unstaged: `features/book/services/book-recurring.service.ts`, `features/book/components/BookRecurring.tsx`, `app/books/[bookId]/recurring/`, `components/AppDatePicker.tsx`, `components/DatePickerModal.tsx`, plus edits to `services.ts`, `utils/constants.ts`, `types/books.ts`, `types/groups.ts`, `supabase/functions/_shared/run-recurring.ts`.
- [ ] Merge `release/v1.4` → `main`.
- [ ] Write `documentation/versions/v1.4/CHANGELOG.md` + release notes (see the v1.3 folder for the format), and run `/release-prep` for store copy.

---

## F. Post-deploy verification (prod)

- [ ] Sign in on a prod build → **Books** tab loads; create a book, add an expense, edit, delete.
- [ ] Free account hits the **5 personal expenses/day** cap and the counter is independent of the group expense cap.
- [ ] Pro account: create a personal recurring template in a book → confirm `next_run_at` is set, then confirm the next hourly cron run materializes exactly one `personal_expenses_tbl` row (and does **not** double-post across two runs).
- [ ] Group recurring still posts correctly — the same function now handles both paths, so re-test the group side after deploying.
- [ ] **Recurring notifications, both surfaces.** After a cron run that posts a group occurrence and a book occurrence: the creator/owner gets one `recurring_posted` push each (not one per member, not one per period), the in-app row renders with the repeat glyph and **no "<your name>" prefix**, and tapping it opens the group expense / the book expense form respectively. Toggle Profile → Push Notifications → **Recurring Expenses** off and confirm the next run inserts the in-app row but sends no push.
- [ ] Create a group with a non-PHP currency as Pro → new expenses seed to it and the group's net-balance hero + Stats tab display it. Free account: picker stays locked at PHP.
- [ ] Existing prod groups still read as PHP and their totals are unchanged.
- [ ] **Split book currencies (Pro).** Create a book with **Book currency = PHP** and **Default for new expenses = JPY** → Add Expense opens on JPY, the saved expense keeps JPY, and the budget bar / Paid / Pending still headline in PHP with the `≈` chip. Then edit the book's currency to SGD and confirm the entry default **stays** JPY (it's pinned) — whereas a book left on "Same as book currency" follows the change. Free account: the second field isn't shown at all.
- [ ] Existing prod books (all `default_expense_currency IS NULL`) still open Add Expense in the book's own currency — unchanged behaviour.
- [ ] Scan a receipt from both a group and a book.
- [ ] Offline: create a book expense in airplane mode → "Syncing…" badge → flushes on reconnect.
- [ ] Book with a budget + expenses in two currencies → the bar folds the foreign spend in, the headline reads `≈`, and the caption shows the **rate date from the table** (not the shipped `2026-08-01` fallback). A stale date here means the app is falling back, i.e. the table or its RLS `SELECT` policy isn't live in `public`.
- [ ] Profile → **Overview Hero** → pick "Personal Spending", force-quit, relaunch → the Overview opens on the personal page with no visible slide. Switch back to "Net Balance" and confirm it sticks. A PGRST204 toast here means migration A8's `NOTIFY pgrst` never landed.

---

## Rollback notes

- **Migrations are additive.** `groups_tbl.currency` defaults to `'PHP'`, so an older client that doesn't send it still inserts valid rows — the column can stay if the app build is rolled back.
- **The personal tables are unreferenced by the group domain**, so leaving them in place after an app rollback is inert (nothing writes to them without the new client).
- **The one destructive statement** is the `user_preferences_tbl` `DROP COLUMN app_mode / monthly_budget` in A1 — a no-op in prod, since those columns only ever existed in `dev`. Confirm that before running if you're unsure.
- **`run-recurring` can be rolled back independently** of the migrations (redeploy the previous version); the personal indexes it relies on are harmless on their own.
- **Rolling back the *app* while `run-recurring` stays deployed** leaves older clients receiving `recurring_posted` / `recurring_review` rows they don't know: they render as the generic "… sent you a notification" and tapping them toasts "No longer available" (`getNotificationRoute` returns null for unknown types). Ugly but harmless — no crash, and the expenses themselves are unaffected. Roll the function back too if that's user-visible for long.
