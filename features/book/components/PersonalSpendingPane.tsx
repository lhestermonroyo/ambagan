import CurrencyCountButton from "@/components/CurrencyCountButton";
import HeroAmount from "@/components/HeroAmount";
import HeroColumn from "@/components/HeroColumn";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { AmountTextSize } from "@/features/expense/utils/amountTextSize";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { PersonalBookTotal, PersonalOverview } from "@/types/books";
import {
  BASE_CURRENCY,
  getRate,
  useConvertedTotal,
  useFxRates
} from "@/utils/fx";
import {
  Minus,
  PiggyBank,
  TrendingDown,
  TrendingUp
} from "lucide-react-native";
import { useMemo } from "react";

/**
 * Month-to-date personal spending as the Overview hero's second page, in the
 * same three bands as the net-balance page it swaps with: headline, divider,
 * two half-width stats.
 *
 * Sharing that skeleton is load-bearing, not cosmetic. The two pages occupy one
 * slot in a pager, so a personal page built to its own shape — as this was when
 * it lived below the hero as a card — makes the purple block change height
 * mid-swipe. Both pages therefore go through HeroAmount + HeroColumn, and the
 * headline size is handed down (see usePersonalSpendSummary's caller) rather
 * than fitted here, so neither page can be a step larger than the other.
 *
 * The headline folds every currency into one figure the way the net-balance
 * page does — an earlier version stacked a raw row per currency, which left the
 * card with no single answer to "how much have I spent" and disagreed with the
 * grammar of every other stat on the screen. Spend is a summary nobody pays
 * directly, so folding it is safe (see utils/fx); the exact per-currency
 * working, pending included, stays one tap away behind the chip.
 *
 * Headline is PAID spend only, matching the run that fills a book's budget bar.
 * Pending rides along as each row's secondary figure in the breakdown sheet
 * rather than taking a band of its own.
 */
export default function PersonalSpendingPane({
  overview,
  isLoading,
  amountSize,
  onPress
}: {
  overview: PersonalOverview | null;
  isLoading: boolean;
  /** Shared with the net-balance page so the two can't differ in height. */
  amountSize: AmountTextSize;
  onPress: () => void;
}) {
  const summary = usePersonalSpendSummary(overview);

  // No payload at all — first load, or offline with nothing cached. A zero
  // would be a claim ("you've spent nothing"), so every band says it doesn't
  // know instead. The bands stay: dropping them, as the old card did, would
  // shrink the hero the moment you swiped to it offline.
  const unavailable = !overview;

  return (
    <VStack className="gap-y-4">
      <HeroAmount
        label={`Personal Spending · ${monthName()}`}
        amountText={unavailable ? "—" : summary.amountText}
        amountSize={amountSize}
        currency={BASE_CURRENCY}
        tone="onColor"
        isLoading={isLoading && unavailable}
        amountClassName="text-white"
        chip={
          summary.chipItems.length > 0 ? (
            <CurrencyCountButton
              items={summary.chipItems}
              title="Personal spending"
              subtitle="Paid this month to date, by currency"
              secondaryLabel="pending"
              convertTo={BASE_CURRENCY}
              totalLabel="Total spent"
            />
          ) : undefined
        }
      />

      <Divider className="bg-white/20" />

      <HStack className="items-stretch">
        <HeroColumn
          icon={<summary.trend.Icon size={14} color="#fff" />}
          label={`vs ${lastMonthName()}`}
          valueText={unavailable ? "—" : summary.trend.value}
          accessibilityLabel={
            unavailable
              ? "Comparison with last month unavailable"
              : summary.trend.spoken
          }
        />
        <Divider orientation="vertical" className="mx-4 bg-white/20" />
        <HeroColumn
          icon={<PiggyBank size={14} color="#fff" />}
          label="Budgets Over"
          valueText={unavailable ? "—" : summary.budget.value}
          accessibilityLabel={
            unavailable ? "Budgets unavailable" : summary.budget.spoken
          }
        />
      </HStack>
    </VStack>
  );
}

/**
 * Everything the personal hero page shows, derived once.
 *
 * Exported because the Overview needs the same figures twice over: the compact
 * bar that replaces the hero on scroll mirrors this page while it's the active
 * one, and the shared headline size can only be worked out by fitting BOTH
 * pages' figures. Two callers, one derivation — a bar that disagreed with the
 * page it faded in from would read as a bug.
 */
export function usePersonalSpendSummary(overview: PersonalOverview | null) {
  const fx = useFxRates();

  // This page spans every book, so it has no one book's currency to lead with —
  // it folds into the app's home currency. The exact per-currency working stays
  // behind the chip.
  const paidItems = useMemo(
    () => toPaidItems(overview?.thisMonth ?? [], BASE_CURRENCY),
    [overview]
  );
  const prevPaidItems = useMemo(
    () => toPaidItems(overview?.lastMonth ?? [], BASE_CURRENCY),
    [overview]
  );

  const { total, convertedCurrencies } = useConvertedTotal(
    paidItems,
    BASE_CURRENCY
  );
  const { total: previousTotal } = useConvertedTotal(
    prevPaidItems,
    BASE_CURRENCY
  );

  // Chip rows carry pending as the secondary figure, so the one tap that
  // explains the "≈" also answers "what's still unpaid".
  const chipItems = useMemo(
    () =>
      [...(overview?.thisMonth ?? [])]
        .sort(byPrimaryFirst(BASE_CURRENCY))
        .map((t) => ({
          currency: t.currency,
          amount: t.paid,
          secondaryAmount: t.pending
        })),
    [overview]
  );

  const budget = useMemo(
    () => rollUpBudgets(overview?.budgets ?? [], fx),
    [overview, fx]
  );

  const trend = useMemo(
    () => trendFor(total, previousTotal),
    [total, previousTotal]
  );

  const isApprox = convertedCurrencies.length > 0;
  const amountText = `${isApprox ? "≈ " : ""}${formatAmount(total, BASE_CURRENCY)}`;

  return { total, isApprox, amountText, chipItems, trend, budget };
}

/**
 * Month-to-date against the same stretch of last month (the service truncates
 * the comparison window — see monthWindows).
 *
 * The column shows a bare percentage because half a hero row has no room for a
 * sentence; direction is carried by the badged arrow, and the full wording —
 * including the "to date" that keeps the comparison honest — survives as the
 * spoken label. Direction isn't coloured: on the primary fill a red figure
 * fights the background, and spending more than last month is worth noticing
 * but isn't a failure the way a blown cap is.
 */
function trendFor(current: number, previous: number) {
  if (current === 0 && previous === 0) {
    return {
      Icon: Minus,
      value: "—",
      spoken: "No personal spending yet this month"
    };
  }

  // Nothing to divide by — a percentage against zero is either infinite or
  // meaningless, so the column shows no figure and says why out loud.
  if (previous === 0) {
    return {
      Icon: Minus,
      value: "—",
      spoken: "Nothing spent by this point last month"
    };
  }

  const pct = Math.round(((current - previous) / previous) * 100);

  if (pct === 0) {
    return {
      Icon: Minus,
      value: "0%",
      spoken: "About the same as last month to date"
    };
  }

  const isUp = pct > 0;
  return {
    Icon: isUp ? TrendingUp : TrendingDown,
    value: `${isUp ? "↑" : "↓"} ${Math.abs(pct)}%`,
    spoken: `${Math.abs(pct)}% ${isUp ? "more" : "less"} than last month to date`
  };
}

/**
 * How the budgeted books are doing, as "over of budgeted". Each book's spend is
 * converted into its OWN budget currency on the same terms its budget card
 * uses, so the rollup and the card a tap away can't disagree about whether a
 * book is over. The worst offender no longer fits on screen, so it survives in
 * the spoken label and on the Books tab a tap away.
 */
function rollUpBudgets(
  budgets: PersonalOverview["budgets"],
  fx: ReturnType<typeof useFxRates>
) {
  let over = 0;
  let worst: { name: string; pct: number } | null = null;

  for (const budget of budgets) {
    let spent = 0;
    for (const item of budget.spent) {
      const rate = getRate(fx, item.currency, budget.currency);
      // No rate — left out rather than counted as zero, so a book is only ever
      // reported as under-spent, never falsely over.
      if (rate === null) continue;
      spent += item.amount * rate;
    }
    const pct = (spent / budget.budget) * 100;
    if (pct > 100) over += 1;
    if (!worst || pct > worst.pct) worst = { name: budget.name, pct };
  }

  const total = budgets.length;

  if (total === 0) {
    return {
      over: 0,
      total: 0,
      value: "—",
      spoken: "Set a budget on a book to track it here"
    };
  }

  const plural = total === 1 ? "" : "s";
  const worstNote = worst
    ? `, highest ${worst.name} at ${Math.round(worst.pct)} percent`
    : "";
  const spoken =
    over > 0
      ? `${over} of ${total} budget${plural} over${worstNote}`
      : `All ${total} budget${plural} on track${worstNote}`;

  return { over, total, value: `${over} of ${total}`, spoken };
}

/** Paid spend as plain currency amounts, home currency first. */
function toPaidItems(
  totals: PersonalBookTotal[],
  primary: string
): { currency: string; amount: number }[] {
  return [...totals]
    .sort(byPrimaryFirst(primary))
    .map((t) => ({ currency: t.currency, amount: t.paid }));
}

function byPrimaryFirst(primary: string) {
  return (a: { currency: string }, b: { currency: string }) => {
    if (a.currency === primary) return -1;
    if (b.currency === primary) return 1;
    return 0;
  };
}

/** "August" — the window the page's figures cover. */
function monthName(): string {
  return new Date().toLocaleString("en-US", { month: "long" });
}

/** "July" — what the trend column compares against. */
function lastMonthName(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString("en-US", { month: "long" });
}
