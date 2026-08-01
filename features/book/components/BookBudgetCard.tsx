import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  expenseCategoryColor,
  expenseCategoryLabel
} from "@/features/expense/components/CategorySheet";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { Book, PersonalBookTotal } from "@/types/books";
import { useMemo } from "react";

/** Categories shown individually in the legend; the rest fold into "Others". */
const LEGEND_LIMIT = 5;

/** Neutral swatch for the "Others" bucket and the pending segment. */
const NEUTRAL_COLOR = "#94A3B8";

/**
 * Progress against a book's spending cap. Only expenses in the book's OWN
 * currency count — a mixed PHP/JPY trip book never converts one into the other,
 * matching how the Stats tab scopes its figures to the primary currency.
 *
 * Paid spend fills the bar, split into one colored segment per spending
 * category (largest first) with a legend underneath; pending (upcoming/unpaid)
 * bills are drawn as a neutral segment stacked on top, so an about-to-be-blown
 * budget is visible before the money actually leaves.
 *
 * When paid/pending breakdowns are passed in, the card also carries the book's
 * total spent stats in a divided-off footer.
 *
 * Renders nothing when the book has no budget set.
 */
export default function BookBudgetCard({
  book,
  totals,
  paidByCurrency,
  pendingByCurrency,
  primaryCurrency = book.currency
}: {
  book: Book;
  /** Spend for the budget's window — this month's for 'monthly', all-time for 'total'. */
  totals: PersonalBookTotal[];
  /** Book-wide paid spend per currency, shown in the card's stats footer. */
  paidByCurrency?: { currency: string; amount: number }[];
  /** Book-wide pending spend per currency, shown in the card's stats footer. */
  pendingByCurrency?: { currency: string; amount: number }[];
  primaryCurrency?: string;
}) {
  const budget = book.budget;
  const currency = book.currency;
  const isMonthly = book.budget_period !== "total";

  const { paid, pending, byCategory } = useMemo(() => {
    const entry = totals.find((t) => t.currency === currency);
    return {
      paid: entry?.paid ?? 0,
      pending: entry?.pending ?? 0,
      // Paid spend only — the bar's colored run is money already out.
      byCategory: (entry?.byCategory ?? [])
        .filter((c) => c.paid > 0)
        .sort((a, b) => b.paid - a.paid)
    };
  }, [totals, currency]);

  // Top categories keep their own color; the tail folds into one neutral
  // "Others" slice so a 10-category book doesn't produce a 10-row legend.
  const slices = useMemo(() => {
    const head = byCategory.slice(0, LEGEND_LIMIT).map((c) => ({
      key: c.category,
      label: expenseCategoryLabel(c.category),
      color: expenseCategoryColor(c.category),
      amount: c.paid
    }));
    const tail = byCategory.slice(LEGEND_LIMIT);
    if (tail.length > 0) {
      head.push({
        key: "__others",
        label: "Others",
        color: NEUTRAL_COLOR,
        amount: tail.reduce((sum, c) => sum + c.paid, 0)
      });
    }
    return head;
  }, [byCategory]);

  if (budget == null || budget <= 0) return null;

  const remaining = budget - paid;
  const isOver = remaining < 0;
  // Pending is only "at risk" up to what's still left — anything beyond the cap
  // is already over-budget and shown by the over-budget state instead.
  const atRisk = Math.min(pending, Math.max(remaining, 0));

  const paidPct = Math.min((paid / budget) * 100, 100);
  const pendingPct = Math.min((atRisk / budget) * 100, 100 - paidPct);

  return (
    <VStack className="mx-4 p-4 rounded-xl bg-secondary-100 gap-y-4">
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
          <Text
            bold
            className="text-2xl"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatAmount(paid, currency)}
          </Text>
          <Text className="text-secondary-950">
            of {formatAmount(budget, currency)}
          </Text>
        </HStack>

        {/* Paid fills the bar as one segment per category; pending stacks after
            it in neutral gray. Over budget the segments still carry their own
            colors — the bar just runs full and the copy below turns red, which
            keeps "where the money went" readable in the state you most want to
            read it. Books cached before per-category totals existed fall back
            to a single primary-colored run. */}
        <Box className="h-2 rounded-full bg-secondary-200 overflow-hidden">
          <HStack className="h-full">
            {slices.length > 0 ? (
              slices.map((s) => (
                <Box
                  key={s.key}
                  className="h-full"
                  style={{
                    width: `${(s.amount / paid) * paidPct}%`,
                    backgroundColor: s.color
                  }}
                />
              ))
            ) : (
              <Box
                className={`h-full ${isOver ? "bg-error-600" : "bg-primary-500"}`}
                style={{ width: `${paidPct}%` }}
              />
            )}
            {pendingPct > 0 && (
              <Box
                className="h-full bg-secondary-400"
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

        {/* The pending figure itself lives in the Pending card below, so only
            the part that card can't tell you stays here: that those bills are
            enough to blow this budget. */}
        {atRisk > 0 && pending > remaining && !isOver && (
          <Text className="text-sm text-secondary-950">
            Pending bills are enough to go over budget.
          </Text>
        )}

        {/* Which color is which category — the bar's own segment widths carry
            the weighting. Wraps, so a long label never squeezes the next
            entry. */}
        {slices.length > 0 && (
          <HStack className="flex-wrap items-center gap-x-4 gap-y-1 pt-1">
            {slices.map((s) => (
              <HStack key={s.key} className="items-center gap-x-1.5">
                <Box
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <Text className="text-sm text-secondary-950">{s.label}</Text>
              </HStack>
            ))}
            {atRisk > 0 && (
              <HStack className="items-center gap-x-1.5">
                <Box className="w-2 h-2 rounded-full bg-secondary-400" />
                <Text className="text-sm text-secondary-950">Pending</Text>
              </HStack>
            )}
          </HStack>
        )}
      </VStack>

      {/* Book-wide paid/pending stats, divided off from the budget above —
          these cover the whole book, not just the budget's window. */}
      {paidByCurrency && pendingByCurrency && (
        <VStack className="gap-y-4">
          <Divider />
          <HStack className="items-stretch">
            <VStack className="flex-1 gap-y-1 pr-3">
              <Text className="text-sm text-secondary-950 uppercase">Paid</Text>
              <CurrencyAmountDisplay
                items={paidByCurrency}
                label="Paid"
                subtitle="Settled spend, by currency"
                primaryCurrency={primaryCurrency}
                amountClassName="text-background-950"
                fitAmount
              />
            </VStack>
            <Divider orientation="vertical" className="mx-4" />
            <VStack className="flex-1 gap-y-1 pl-3">
              <Text className="text-sm text-secondary-950 uppercase">
                Pending
              </Text>
              <CurrencyAmountDisplay
                items={pendingByCurrency}
                label="Pending"
                subtitle="Upcoming spend, by currency"
                primaryCurrency={primaryCurrency}
                amountClassName="text-background-950"
                fitAmount
              />
            </VStack>
          </HStack>
        </VStack>
      )}
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
