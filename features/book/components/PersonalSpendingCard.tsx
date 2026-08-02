import CurrencyCountButton from "@/components/CurrencyCountButton";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { PersonalBookTotal, PersonalOverview } from "@/types/books";
import {
  BASE_CURRENCY,
  getRate,
  useConvertedTotal,
  useFxRates
} from "@/utils/fx";
import {
  getErrorHex,
  getSecondaryHex,
  getSuccessHex
} from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react-native";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

/**
 * Month-to-date personal spending on the Overview, in three bands: what was
 * spent, how that compares with last month, and how the budgeted books are
 * holding up.
 *
 * The headline folds every currency into one figure the way the net-balance
 * hero above it does — an earlier version stacked a raw row per currency, which
 * left the card with no single answer to "how much have I spent" and disagreed
 * with the grammar of every other stat on the screen. Spend is a summary nobody
 * pays directly, so folding it is safe (see utils/fx); the exact per-currency
 * working, pending included, stays one tap away behind the chip.
 *
 * Headline is PAID spend only, matching the run that fills a book's budget bar.
 * Pending rides along as each row's secondary figure in the breakdown sheet
 * rather than taking a band of its own.
 */
export default function PersonalSpendingCard({
  overview,
  isLoading,
  onPress
}: {
  overview: PersonalOverview | null;
  isLoading: boolean;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme() ?? "light";

  // This card spans every book, so it has no one book's currency to lead with —
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

  const budgets = useMemo(() => overview?.budgets ?? [], [overview]);

  const isApprox = convertedCurrencies.length > 0;

  return (
    <Pressable onPress={onPress} accessibilityLabel="Open Books">
      {({ pressed }) => (
        <VStack
          className={cn(
            pressed ? "bg-secondary-200" : "bg-secondary-100",
            "mx-4 p-4 rounded-xl gap-y-3"
          )}
        >
          <HStack className="items-center justify-between gap-x-2">
            <Text
              bold
              className="text-sm text-secondary-950 uppercase flex-1"
              numberOfLines={1}
            >
              Personal Spending · {monthName()}
            </Text>
            <ChevronRight
              size={18}
              color={getSecondaryHex("text-secondary-950", colorScheme)}
            />
          </HStack>

          {/* No payload at all — first load, or offline with nothing cached.
              A zero would be a claim ("you've spent nothing"), so the card says
              it doesn't know instead, and drops the bands it can't fill. */}
          {!overview ? (
            <VStack className="gap-y-1">
              <Text bold className="text-2xl">
                —
              </Text>
              <Text className="text-sm text-secondary-950">
                {isLoading
                  ? "Loading…"
                  : "Spending unavailable — check your connection"}
              </Text>
            </VStack>
          ) : (
            <>
              <VStack className="gap-y-1">
                <HStack className="items-center gap-x-2">
                  <Text
                    bold
                    className="text-2xl flex-shrink"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isApprox ? "≈ " : ""}
                    {formatAmount(total, BASE_CURRENCY)}
                  </Text>
                  {chipItems.length > 0 && (
                    <CurrencyCountButton
                      items={chipItems}
                      title="Personal spending"
                      subtitle="Paid this month, by currency"
                      secondaryLabel="pending"
                      convertTo={BASE_CURRENCY}
                      totalLabel="Total spent"
                    />
                  )}
                </HStack>

                <TrendLine current={total} previous={previousTotal} />
              </VStack>

              <Divider />

              <BudgetRollup budgets={budgets} />
            </>
          )}
        </VStack>
      )}
    </Pressable>
  );
}

/**
 * Month-to-date against the same stretch of last month (the service truncates
 * the comparison window — see monthWindows). Direction is carried by a colored
 * arrow rather than the copy: spending less is worth noticing, but spending
 * more isn't an error, so neither gets error styling.
 */
function TrendLine({
  current,
  previous
}: {
  current: number;
  previous: number;
}) {
  const colorScheme = useColorScheme() ?? "light";

  if (current === 0 && previous === 0) {
    return (
      <Text className="text-sm text-secondary-950">
        No personal spending yet this month
      </Text>
    );
  }

  // Nothing to divide by — a percentage against zero is either infinite or
  // meaningless, so the line says what actually happened instead.
  if (previous === 0) {
    return (
      <Text className="text-sm text-secondary-950">
        Nothing spent by this point last month
      </Text>
    );
  }

  const pct = Math.round(((current - previous) / previous) * 100);

  if (pct === 0) {
    return (
      <Text className="text-sm text-secondary-950">
        About the same as last month to date
      </Text>
    );
  }

  const isUp = pct > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  // The arrow is the only thing that judges the number — a soft red rather than
  // the error-600 an over-budget book gets, because spending more than last
  // month is worth noticing but isn't a failure the way a blown cap is.
  const iconColor = isUp
    ? getErrorHex("text-error-400", colorScheme)
    : getSuccessHex("text-success-600", colorScheme);

  return (
    <HStack className="items-center gap-x-1">
      <Icon size={14} color={iconColor} />
      <Text className="text-sm text-secondary-950" numberOfLines={1}>
        {Math.abs(pct)}% {isUp ? "more" : "less"} than last month to date
      </Text>
    </HStack>
  );
}

/**
 * One line on how the budgeted books are doing. Each book's spend is converted
 * into its OWN budget currency on the same terms its budget card uses, so the
 * rollup and the card a tap away can't disagree about whether a book is over.
 */
function BudgetRollup({ budgets }: { budgets: PersonalOverview["budgets"] }) {
  const fx = useFxRates();

  const { over, worst, total } = useMemo(() => {
    let over = 0;
    let worst: { name: string; pct: number } | null = null;

    for (const budget of budgets) {
      let spent = 0;
      for (const item of budget.spent) {
        const rate = getRate(fx, item.currency, budget.currency);
        // No rate — left out rather than counted as zero, so a book is only
        // ever reported as under-spent, never falsely over.
        if (rate === null) continue;
        spent += item.amount * rate;
      }
      const pct = (spent / budget.budget) * 100;
      if (pct > 100) over += 1;
      if (!worst || pct > worst.pct) worst = { name: budget.name, pct };
    }

    return { over, worst, total: budgets.length };
  }, [budgets, fx]);

  if (total === 0) {
    return (
      <Text className="text-sm text-secondary-950" numberOfLines={1}>
        Set a budget on a book to track it here
      </Text>
    );
  }

  const label =
    over > 0
      ? `${over} of ${total} budget${total === 1 ? "" : "s"} over`
      : `All ${total} budget${total === 1 ? "" : "s"} on track`;

  return (
    <HStack className="items-center justify-between gap-x-3">
      <Text
        className={cn(
          "text-sm flex-shrink",
          over > 0 ? "text-error-600 font-medium" : "text-secondary-950"
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
      {worst && (
        <Text className="text-sm text-secondary-950" numberOfLines={1}>
          {worst.name} {Math.round(worst.pct)}%
        </Text>
      )}
    </HStack>
  );
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

/** "August" — the window the card's figures cover. */
function monthName(): string {
  return new Date().toLocaleString("en-US", { month: "long" });
}
