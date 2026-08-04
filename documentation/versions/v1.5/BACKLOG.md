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

## 2. NOT doing: "More options" on the group form

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
