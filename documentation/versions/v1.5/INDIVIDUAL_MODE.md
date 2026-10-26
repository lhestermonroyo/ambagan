# Group and Individual modes

The Groups tab has separate Groups and Individual lists, each ordered by recent
activity. A settlement-style filter button opens a radio selection sheet:
Groups offers All, Created, Joined, and Archived; Individual offers All and
Archived. Each list remembers its selected filter. Mode filters apply before
server pagination and to offline snapshots.

Search mixes Group and Individual results regardless of the selected mode and
loads all matching source pages. Archived searches include both archived modes;
other filters search active entries. The Individual badge sits before the row's
chevron, in the same trailing slot used for shared-group member avatars.

Creation defaults to Group; selecting Individual
hides member selection and creates a private individual expense recorder. The Mode
selector sits directly below the currency field. Mode is fixed after creation.
Creation asks for one currency, used for reporting and new expenses. Pro users
can set a separate default for new expenses later in Edit Group or Edit
Individual; creation saves that default as null so it follows the entry currency.
Individual details have Expenses, Stats, and Info; the Expenses summary displays
the total amount of all recorded expenses, with Paid and Pending columns below
in the same layout as the Net Balance card. Budget controls and
progress cards are removed.

The Overview hero's Individual Totals page sums all recorded expenses across
all Individual entries, including archived entries and every expense date.
The headline includes Paid and Pending, with separate columns and a matching
compact scroll summary. Currency breakdowns preserve the original amounts;
mixed currencies use the existing approximate PHP conversion. Older monthly
Overview caches are refreshed before they can supply these totals.

Group creation uses the same roster rows as Group Details: owner, admins, then
members, with contact details below names and badges only for Owner and Admin.
The ellipsis menu assigns or removes admin and removes selected members before
creation. Initial admin roles are included in the membership insert and offline
creation payload.

Existing Books appear as Individual entries. Their private ledger tables remain
the storage model, preserving IDs, expenses, receipts, legacy budget metadata, recurring
schedules, and existing group roll-up links. No expense data is copied or deleted.
Legacy `/books` links redirect to Groups; detail/edit URLs remain compatible.

## Database rollout

Apply these migrations before the app update, in this order:

1. `migrations/2026-10-14_group_last_updated_at.sql`
2. `migrations/2026-10-14_individual_group_entries.sql`

They default to `dev`. For production, change each `SET LOCAL search_path` to
`public, extensions`. The second migration provides a security-invoker view
over the existing ledgers, so owner/member RLS still applies. It also prevents
an expense or recurring schedule from referencing another owner's private ledger.

Archive, restore, delete, expense entry, and scanning dispatch to the correct
ledger based on mode. Offline creation and edits update both the private ledger
cache and unified Groups list. Archived entries stay out of active destination
pickers. Internal book service and route names are retained for compatibility.
