import { Group } from "@/types/groups";

/**
 * The currency a NEW expense on this group starts in.
 *
 * `default_expense_currency` is null on almost every group, meaning "follow the
 * group's currency" — resolving it here rather than defaulting the column keeps
 * the two in step when the group's currency is later edited. Every entry
 * surface (Add Expense, Scan Receipt, the recurring template) goes through this
 * so they can't drift apart on which fallback they use.
 *
 * NOT the currency to report in — that's always `group.currency`. See
 * utils/fx for which surfaces convert and which must not.
 *
 * The group twin of `bookEntryCurrency()`, with one added fallback: a group
 * cached before group currency shipped has neither column, and `undefined`
 * would blank the picker. Callers pass BASE_CURRENCY through as the floor.
 */
export function groupEntryCurrency(
  group:
    | {
        currency?: Group["currency"] | null;
        default_expense_currency?: Group["default_expense_currency"];
      }
    | null
    | undefined
): string | undefined {
  if (!group) return undefined;
  return group.default_expense_currency ?? group.currency ?? undefined;
}

/**
 * What to actually persist for a group's entry currency.
 *
 * Storing a value equal to `currency` looks harmless and isn't: it freezes a
 * copy, so editing the group's currency later leaves new expenses pinned to the
 * OLD one with nothing on screen explaining why. Normalizing to null keeps
 * "same as the group currency" a live link rather than a snapshot.
 *
 * Also absorbs the empty-string CURRENCY_SAME_AS sentinel the picker emits, so
 * no caller has to know the sentinel's wire shape.
 */
export function normalizeEntryCurrency(
  defaultExpenseCurrency: string | null | undefined,
  currency: string
): string | null {
  if (!defaultExpenseCurrency) return null;
  return defaultExpenseCurrency === currency ? null : defaultExpenseCurrency;
}
