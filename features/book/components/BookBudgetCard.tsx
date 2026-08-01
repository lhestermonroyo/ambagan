import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { Book, PersonalBookTotal } from "@/types/books";
import { useMemo } from "react";

/**
 * Progress against a book's spending cap. Only expenses in the book's OWN
 * currency count — a mixed PHP/JPY trip book never converts one into the other,
 * matching how the Stats tab scopes its figures to the primary currency.
 *
 * Paid spend fills the bar; pending (upcoming/unpaid) bills are drawn as a
 * lighter segment stacked on top, so an about-to-be-blown budget is visible
 * before the money actually leaves.
 *
 * Renders nothing when the book has no budget set.
 */
export default function BookBudgetCard({
  book,
  totals
}: {
  book: Book;
  /** Spend for the budget's window — this month's for 'monthly', all-time for 'total'. */
  totals: PersonalBookTotal[];
}) {
  const budget = book.budget;
  const currency = book.currency;
  const isMonthly = book.budget_period !== "total";

  const { paid, pending } = useMemo(() => {
    const entry = totals.find((t) => t.currency === currency);
    return { paid: entry?.paid ?? 0, pending: entry?.pending ?? 0 };
  }, [totals, currency]);

  if (budget == null || budget <= 0) return null;

  const remaining = budget - paid;
  const isOver = remaining < 0;
  // Pending is only "at risk" up to what's still left — anything beyond the cap
  // is already over-budget and shown by the over-budget state instead.
  const atRisk = Math.min(pending, Math.max(remaining, 0));

  const paidPct = Math.min((paid / budget) * 100, 100);
  const pendingPct = Math.min((atRisk / budget) * 100, 100 - paidPct);

  return (
    <VStack className="mx-4 p-4 rounded-xl bg-secondary-100 gap-y-3">
      <HStack className="items-center justify-between">
        <Text bold className="text-sm text-secondary-950 uppercase">
          {isMonthly ? "Monthly budget" : "Total budget"}
        </Text>
        <Text className="text-sm text-secondary-950">
          {isMonthly ? monthLabel() : "Whole book"}
        </Text>
      </HStack>

      <VStack className="gap-y-2">
        <HStack className="items-end justify-between">
          <Text bold className="text-2xl" numberOfLines={1} adjustsFontSizeToFit>
            {formatAmount(paid, currency)}
          </Text>
          <Text className="text-secondary-950">
            of {formatAmount(budget, currency)}
          </Text>
        </HStack>

        {/* Paid fills the bar; pending stacks after it at reduced opacity. */}
        <Box className="h-2 rounded-full bg-secondary-200 overflow-hidden">
          <HStack className="h-full">
            <Box
              className={`h-full ${isOver ? "bg-error-600" : "bg-primary-500"}`}
              style={{ width: `${paidPct}%` }}
            />
            {pendingPct > 0 && (
              <Box
                className="h-full bg-primary-500/40"
                style={{ width: `${pendingPct}%` }}
              />
            )}
          </HStack>
        </Box>

        <HStack className="items-center justify-between">
          <Text
            className={`text-sm ${isOver ? "text-error-600" : "text-secondary-950"}`}
          >
            {isOver
              ? `${formatAmount(Math.abs(remaining), currency)} over budget`
              : `${formatAmount(remaining, currency)} left`}
          </Text>
          <Text className="text-sm text-secondary-950">
            {Math.round((paid / budget) * 100)}%
          </Text>
        </HStack>

        {atRisk > 0 && (
          <Text className="text-sm text-secondary-950">
            {formatAmount(pending, currency)} pending
            {pending > remaining && !isOver
              ? " — enough to go over budget"
              : ""}
          </Text>
        )}
      </VStack>
    </VStack>
  );
}

/** "July · 18 days left" — the window a monthly budget is measured over. */
function monthLabel(): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();
  const left = daysInMonth - now.getDate();
  if (left === 0) return `${month} · last day`;
  return `${month} · ${left} day${left === 1 ? "" : "s"} left`;
}
