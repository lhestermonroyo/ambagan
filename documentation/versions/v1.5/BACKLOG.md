# v1.5 — Backlog

Work deliberately held back from v1.4. Each item says why it waited, so the
reason can be re-checked rather than re-derived.

---

## 1. Split `groups_tbl.currency` into reporting + entry

Mirror the book change that shipped in v1.4 (`personal_books_tbl.currency` +
`default_expense_currency`) onto groups.

### Why

`groups_tbl.currency` is doing the same double duty books were:

- **Reporting** — [`GroupStatsTab.tsx`](../../../features/group/components/GroupStatsTab.tsx)
  sets `primaryCurrency = groupDetails?.currency` and converts into it;
  [`GroupMemberBreakdown.tsx`](../../../features/group/components/GroupMemberBreakdown.tsx)
  converts paid/share/net into it; [`GroupSettlements.tsx`](../../../features/group/components/GroupSettlements.tsx)
  passes `convertTo={primaryCurrency}` for the To Collect / To Pay headline
  totals. (Individual settlement amounts keep their own currency — only the
  roll-up converts.)
- **Entry** — [`add-expense.tsx`](../../../app/groups/[groupId]/add-expense.tsx)
  seeds the currency picker from it.

A "Japan Trip" group is the canonical multi-currency case, and unlike a book the
cost of the missing split is paid by **every member**, not one owner — each of
them re-picks JPY on every expense.

### Why it did NOT ride v1.4

- v1.4 already carries 11 pending prod migrations. A 12th touching the group Add
  Expense form — the most-used screen in the app — was avoidable risk on a
  branch already at release.
- The book split was still unvalidated end-to-end when this was raised. Two of
  its rules were unproven and are better shaken out on a single-owner surface
  than on shared group data: the **normalize-to-null** rule (editing a group's
  currency must carry over a "same as" setting but leave a pinned one alone) and
  the `CURRENCY_SAME_AS` sentinel round-tripping through the offline queue.
  **Gate this item on those passing on books first.**

### Open decision — do NOT inherit this from books

A book's currencies are the owner's alone. A group's are **shared**: the
creator's "default for new expenses" would apply to every member's entry.

> **When a member's own preferred currency differs from the group's default,
> which wins?**

Books never had to answer this. Current instinct is the group's default wins —
it's what makes a trip group cohere, and `currency` is already shared this way —
but make the call deliberately rather than discovering it after ship.

### Shape (follows the book implementation exactly)

- Migration: `groups_tbl.default_expense_currency text` — **nullable, no
  DEFAULT**. NULL = follow `currency`. `^[A-Z]{3}$` shape check. Ends with
  `NOTIFY pgrst, 'reload schema';` — the group select names the column, so a
  stale cache breaks group reads, not just writes.
- Never store a value equal to `currency` — normalize to NULL in the service,
  the offline-queue args, and the optimistic builder, or a later currency edit
  leaves a stale frozen copy.
- Resolve through a helper like
  [`bookEntryCurrency()`](../../../features/book/utils/bookCurrency.ts) rather
  than reading the column raw, so every entry surface shares one fallback.
- UI: `CurrencySelectionSheet` already supports the inherit option via the
  `sameAs` prop — no new component needed.
- Touchpoints: group service + `GROUP_SELECT`, offline queue args/optimistic,
  group `add-expense.tsx` seed, group `scan-receipt`, recurring template,
  `GroupDetailsTab`, create/edit group form.

---

## 2. Recurrence trigger dates + semi-monthly

Let a recurring template say *which* days it fires on, not just how often.
Day selection applies to **weekly**, **semi-monthly** and **monthly**; daily has
nothing to pick.

Raised 2026-08-08, deferred out of v1.4 the same day.

### Why

Today a template is a **step machine**: one `next_run_at` cursor advanced by
`frequency × interval` ([`advanceByFrequency`](../../../features/expense/utils/recurrence.util.ts),
mirrored by `advance()` in [`run-recurring.ts`](../../../supabase/functions/_shared/run-recurring.ts)).
Which day it lands on is implicit — whatever `start_date` happened to be. You
cannot express "the 15th and the last day", which is the **kinsenas–katapusan**
payroll cadence most PH recurring bills follow. That makes this a strong fit for
the app's market, not a generic scheduling nicety.

### Why it did NOT ride v1.4

v1.4's backend went live in prod 2026-08-07 and was verified end to end. This
would reopen it: two more migrations to dev *and* prod, a `run-recurring`
redeploy, a new build, and a re-run of §F.

More importantly, the generator is the **worst place in the app to take a late
risk**. It runs unattended, hourly, and creates money rows. Its failures are
either silent (a missed occurrence looks like nothing happened) or expensive (a
double-post). Prod had **zero** recurring templates at deploy time, so it is also
the least field-validated path in the codebase.

### Do NOT add `semi_monthly` as a frequency

Model it as **monthly with multiple days**, and make "Semi-monthly" a *UI preset*
that selects two days.

- No `CHECK` migration on `frequency` across two tables, and no third branch in
  the generator.
- `repeat_interval` stays coherent: "every 2 months on the 15th and last day"
  is meaningful, whereas `semi_monthly` + interval 2 is nonsense you would have
  to special-case and block.
- `recurrenceSummary` can render "Repeats semi-monthly" whenever a monthly rule
  has exactly two days, so the familiar label survives without a third concept
  underneath it.

### Do the shared-math extraction FIRST

The date math exists **twice** — client (`recurrence.util.ts`) and server
(`run-recurring.ts`) — kept in sync by hand, as the code comments admit. Two
copies of simple step arithmetic is already a latent drift bug. Two copies of
multi-day matching *with month-end clamping* is asking for one, and a one-day
disagreement between client and server on a money-posting job is silent and
nasty.

Extract the pure date math into one dependency-free module both import (Deno can
import a plain relative `.ts`; keep `date-fns` as its only dependency, via the
`npm:` specifier server-side). **Land this refactor on its own, with the current
behaviour unchanged and green, before making the rule richer.**

### The two traps

1. **Month-end.** The 31st does not exist in April; the 30th does not exist in
   February. Store **`-1` as a "last day of month" sentinel** — *katapusan* is
   dynamic, not "the 30th". For an out-of-range numeric day, **clamp to the last
   day, never skip**: "the 31st" in February must mean Feb 28/29. Skipping is
   silent — no error surfaces anywhere, the month just vanishes.
2. **Weekly with `interval > 1`.** "Every 2 weeks on Mon & Thu" is ambiguous
   without a week anchor. Anchor on `start_date`'s ISO week or the series drifts.

### Shape

Add to **both** `recurring_expenses_tbl` and `personal_recurring_tbl`:

- `days_of_week smallint[]` — 0–6, NULL = derive from `start_date`
- `days_of_month smallint[]` — 1–31 plus the `-1` sentinel, NULL = derive from
  `start_date`

Two typed columns rather than one overloaded `trigger_days`, so switching a
template's frequency cannot carry weekday values into a monthly rule. **NULL on
both is exactly today's behaviour**, so every existing template stays inert and
an app rollback is a no-op.

`advance(date, frequency, interval)` becomes
`nextOccurrence(after, rule)` — a schedule matcher rather than step arithmetic.
The `MAX_CATCHUP` guard and the catch-up loop in `processPersonalTemplate` /
its group twin still apply unchanged.

### What already protects you

`personal_expenses_recurring_period_uidx` on `(recurring_id, expense_date)` still
holds for multi-day rules, since each occurrence lands on a distinct date. The
double-post backstop survives the redesign — verify the group side has the
equivalent index before shipping.

---

## 3. Per-book budget alerts (80% / 100%)

Push the user when a book's budget crosses a threshold. Per-book budgets shipped
in v1.4 (`budget`, `budget_period`), but they are **passive** — the bar only
exists if you open the book.

Deferred out of v1.4 on 2026-08-08.

### The unresolved question — answer this before writing code

**What triggers the evaluation?**

Evaluating on expense save is the obvious hook and mostly pointless: the user is
already on the screen, looking at the budget bar. A push tells them what they can
already see.

The real value is when they are **not** in the app — most concretely when
`run-recurring` auto-posts an occurrence that crosses the threshold. That points
at hooking the generator, or a small daily cron, rather than the client. Decide
this first; it determines whether this is a client change or a server one.

### Shape (once the trigger is settled)

- `user_preferences_tbl.notif_budget_alert boolean NOT NULL DEFAULT true` —
  migration to **both** `dev` and `public`, ending in
  `NOTIFY pgrst, 'reload schema';` like every other pref column.
- Two notification types (`budget_warning`, `budget_exceeded`) added to
  `NOTIF_PREF_KEY` in [`send-push.ts`](../../../supabase/functions/_shared/send-push.ts)
  → `notif_budget_alert`, plus a `send-push` redeploy.
  `notifications_tbl.type` is plain `text` with no CHECK, so no DDL for the values.
- **Fire once per threshold per period**, not once per crossing expense, or a
  busy day sends a stream of pushes. Needs a marker — either a per-period log row
  or a column on the book — decided alongside the trigger.
- `budget_period` matters: `monthly` resets each calendar month, `total` is a
  lifetime cap that can only be crossed once.

### Note

Only expenses in the book's **own** currency count toward the bar today
(`getPersonalBookMonthTotals`). An alert inherits that limitation — a
mixed-currency book can exceed its budget without the alert firing. Either
accept it explicitly or fold in `fx_rates_tbl` (live in prod since v1.4).

---

## 4. Contacts import — flip the flag

`CONTACTS_IMPORT_ENABLED = false` in [`constants/features.ts`](../../../constants/features.ts).

Deferred past v1.2 in favour of QR-code group invites; **re-deferred out of v1.4
on 2026-08-08 as a product call, not a technical one.**

### State: ready, not blocked

Verified 2026-08-08 — this is genuinely a one-line change:

- [`ContactPickerSheet.tsx`](../../../features/group/components/ContactPickerSheet.tsx)
  is fully implemented (dedupe by normalized phone, excludes existing members,
  links known accounts instead of minting ghosts).
- Wired behind the flag in `MembersSelectionSheet` and `EditMemberSheet`.
- `expo-contacts ~56.0.12` is installed and configured in `app.json` with a
  `contactsPermission` string, so it is **already in the shipped binary** — no
  native change, no migration, no Edge Function.
- **The permission flow satisfies the 5.1.1 rule that caused the earlier
  rejection**: `requestPermissionsAsync()` fires immediately when the sheet
  opens, with no custom priming screen before the system dialog, and the
  Settings link appears only in the granted branch. See [[project_appstore_permissions]].

### One thing to fix before flipping it

The `contactsPermission` purpose string in `app.json` is thinner than the camera
and photo ones:

> "Ambagan uses your contacts to add people to your expense groups."

It names the use but gives **no concrete example**, which is the bar 5.1.1(ii)
applies — and a weak purpose string is half of what got 1.3.0 rejected. Bring it
up to the standard of the other two before this ships, e.g. naming that only the
contacts you pick are read and what happens to them. See [[project_appstore_permissions]].

Harmless while the flag is `false` (the prompt never fires), so it is not a v1.4
problem — but it becomes one the moment the flag flips.

### The actual question

Not "does it work" but **"do we want two ways to add people?"** QR invites are
the story v1.2 chose. A second path muddies it. Decide on product grounds; the
engineering is done.

---

## 5. NOT doing: "More options" on the group form

Recorded so it isn't re-proposed.

The book form collapsed five optional fields behind a disclosure. The group form
has Avatar, Name, Category, Currency, and Members — and **Members is the only
optional field**. Hiding who's in a group behind "More options" would bury the
point of a group.

There is nothing left to collapse; the section would cost a tap and buy nothing.

---

## Done in v1.4 (context for item 1)

- Book currency split shipped — see the
  [v1.4 deployment checklist](../v1.4/DEPLOYMENT_CHECKLIST.md) item A11 and its
  two post-deploy smoke tests.
- Group currency helper copy corrected on the create form and `GroupDetailsTab`
  ("Default currency" → "Currency"), which had understated the column as an
  entry default when it is also the conversion target. Copy-only, no schema.
