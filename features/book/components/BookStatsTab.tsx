import CategoryIcon from "@/components/CategoryIcon";
import CurrencyCountButton from "@/components/CurrencyCountButton";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  expenseCategoryColor,
  expenseCategoryMeta
} from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import DateRangeSheet, {
  CustomDateRange,
  DateRangeOption,
  formatDateRangeLabel,
  getDateRangeBounds,
  isWithinRange
} from "@/features/group/components/DateRangeSheet";
import services from "@/services";
import { PersonalExpense } from "@/types/books";
import { EmptyType } from "@/types/general";
import { getRate, useFxRates } from "@/utils/fx";
import { getPrimaryHex } from "@/utils/getColorHex";
import { ChevronDown } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import ApproxRateNote from "./ApproxRateNote";

export default function BookStatsTab({
  bookId,
  primaryCurrency = "PHP"
}: {
  bookId: string;
  primaryCurrency?: string;
}) {
  const colorScheme = useColorScheme() ?? "light";
  // Re-renders when a rate refresh lands, keeping the converted figures and the
  // vintage in the rate note in step.
  const fx = useFxRates();

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [customRange, setCustomRange] = useState<CustomDateRange | null>(null);
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);

  // The Expenses tab paginates, so it only ever holds a page. Stats want the
  // whole book, so fetch the full ledger once here and derive everything from it.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    services.bookExpense
      .getAllPersonalExpensesByBookId(bookId)
      .then((data) => {
        if (!cancelled) setExpenses(data);
      })
      .catch((error) => {
        console.error("Failed to load book stats:", error);
        if (!cancelled) setExpenses([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const { start: cutoff, end: until } = useMemo(
    () => getDateRangeBounds(dateRange, customRange),
    [dateRange, customRange]
  );

  const filtered = useMemo(() => {
    if (!cutoff && !until) return expenses;
    return expenses.filter((e) =>
      isWithinRange(e.expense_date || e.created_at, cutoff, until)
    );
  }, [expenses, cutoff, until]);

  // Total spent, per currency (a trip book can mix PHP + JPY), split into paid
  // vs pending. Never converted — each currency is its own line, matching the
  // Expenses-tab hero.
  const totalsByCurrency = useMemo(() => {
    const byCurrency = new Map<string, { paid: number; pending: number }>();
    filtered.forEach((e) => {
      const currency = e.currency || "PHP";
      const entry = byCurrency.get(currency) ?? { paid: 0, pending: 0 };
      if (e.status === "pending") entry.pending += e.amount;
      else entry.paid += e.amount;
      byCurrency.set(currency, entry);
    });
    return Array.from(byCurrency.entries())
      .map(([currency, v]) => ({ currency, paid: v.paid, pending: v.pending }))
      .sort((a, b) => b.paid + b.pending - (a.paid + a.pending));
  }, [filtered]);

  // Value of an expense in the book's own currency, or null when its currency
  // has no rate. Null means "can't be priced" and the expense is left out of the
  // converted figures entirely — counting it as zero would quietly under-report.
  const inBookCurrency = useCallback(
    (e: PersonalExpense): number | null => {
      const rate = getRate(fx, e.currency || "PHP", primaryCurrency);
      return rate === null ? null : e.amount * rate;
    },
    [fx, primaryCurrency]
  );

  // Which foreign currencies actually contributed to the converted figures —
  // drives the rate note, and tells the copy below whether to say "≈" at all.
  const convertedCurrencies = useMemo(() => {
    const seen = new Set<string>();
    for (const e of filtered) {
      const currency = e.currency || "PHP";
      if (
        currency !== primaryCurrency &&
        getRate(fx, currency, primaryCurrency)
      ) {
        seen.add(currency);
      }
    }
    return Array.from(seen);
  }, [filtered, primaryCurrency, fx]);

  // Count + average across every currency, converted so the average stays a
  // single meaningful figure. Count is of expenses actually priced, so it can't
  // disagree with the average's denominator.
  const primaryStats = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const e of filtered) {
      const value = inBookCurrency(e);
      if (value === null) continue;
      count += 1;
      total += value;
    }
    return { count, average: count > 0 ? total / count : 0 };
  }, [filtered, inBookCurrency]);

  // Biggest paid expenses in range (pending bills aren't money out yet). RANKED
  // by converted value so a ¥5,000 expense sorts correctly against a ₱4,000 one
  // — but each row still renders in its own currency, so the number on screen
  // stays exact and only the ordering relies on a rate.
  const topExpenses = useMemo(
    () =>
      filtered
        .filter((e) => e.status !== "pending" && inBookCurrency(e) !== null)
        .sort((a, b) => (inBookCurrency(b) ?? 0) - (inBookCurrency(a) ?? 0))
        .slice(0, 5),
    [filtered, inBookCurrency]
  );

  // Spending grouped by category (paid only), largest first, with each slice's
  // share of the total. Amounts are converted into the book currency; the
  // percentages are unaffected by that since they're a share of the same total.
  // Falls back to "general" for any unset row.
  const categoryBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    let total = 0;
    filtered
      .filter((e) => e.status !== "pending")
      .forEach((e) => {
        const value = inBookCurrency(e);
        if (value === null) return;
        const key = e.category || "general";
        byCategory.set(key, (byCategory.get(key) ?? 0) + value);
        total += value;
      });

    return Array.from(byCategory.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered, inBookCurrency]);

  if (loading) {
    return (
      <VStack className="pt-2">
        <ExpenseListSkeleton />
      </VStack>
    );
  }

  if (expenses.length === 0) {
    return (
      <VStack className="pt-6">
        <EmptyList type={EmptyType.EXPENSE} />
      </VStack>
    );
  }

  return (
    <>
      <DateRangeSheet
        isOpen={dateRangeSheetOpen}
        onClose={() => setDateRangeSheetOpen(false)}
        dateRange={dateRange}
        customRange={customRange}
        onSelect={(value, custom) => {
          setDateRange(value);
          setCustomRange(custom ?? null);
        }}
      />
      <VStack className="gap-y-6 pb-6">
        {/* Date range filter pill — opens the same sheet the group tabs use */}
        <HStack className="px-4">
          <FormButton
            size="sm"
            variant="outline"
            text={formatDateRangeLabel(dateRange, customRange)}
            iconEnd={
              <ChevronDown
                size={16}
                color={getPrimaryHex("text-primary-500", colorScheme)}
              />
            }
            onPress={() => setDateRangeSheetOpen(true)}
          />
        </HStack>

        {filtered.length === 0 ? (
          <EmptyList
            type={EmptyType.EXPENSE}
            content="No expenses in the selected date range."
          />
        ) : (
          <VStack className="px-4 gap-y-4">
            {/* Total spent */}
            <Card className="rounded-xl bg-secondary-100">
              <VStack className="gap-y-4">
                <SpendingHero
                  items={totalsByCurrency}
                  primaryCurrency={primaryCurrency}
                />
                <Divider />
                <HStack className="items-stretch">
                  <VStack className="flex-1 gap-y-1">
                    <Text className="text-sm text-secondary-950 uppercase">
                      Expenses
                    </Text>
                    <Text bold className="text-lg">
                      {primaryStats.count}
                    </Text>
                  </VStack>
                  <Divider orientation="vertical" className="mx-4" />
                  <VStack className="flex-1 gap-y-1">
                    <Text className="text-sm text-secondary-950 uppercase">
                      Avg / Expense
                    </Text>
                    <Text bold className="text-lg">
                      {convertedCurrencies.length > 0 ? "≈ " : ""}
                      {formatAmount(primaryStats.average, primaryCurrency)}
                    </Text>
                  </VStack>
                </HStack>
              </VStack>
            </Card>

            {/* Top Expenses */}
            {topExpenses.length > 0 && (
              <Card className="rounded-xl bg-secondary-100">
                <VStack className="gap-y-4">
                  <VStack>
                    <Text bold className="text-secondary-950 uppercase text-sm">
                      Top Expenses
                    </Text>
                    <Text className="text-sm text-secondary-950">
                      {convertedCurrencies.length > 0
                        ? "Biggest expenses in this range, ranked across currencies."
                        : "Biggest expenses in this range."}
                    </Text>
                  </VStack>
                  <VStack className="gap-y-3">
                    {topExpenses.map((expense, index) => (
                      <HStack
                        key={expense.id}
                        className="items-center gap-x-3"
                      >
                        <Text className="w-4 text-sm text-secondary-950">
                          {index + 1}
                        </Text>
                        <VStack className="flex-1">
                          <Text numberOfLines={1}>{expense.description}</Text>
                          <Text
                            className="text-sm text-secondary-950"
                            numberOfLines={1}
                          >
                            {expenseCategoryMeta(expense.category).label}
                          </Text>
                        </VStack>
                        <Text className="text-lg font-medium">
                          {formatAmount(expense.amount, expense.currency)}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                </VStack>
              </Card>
            )}

            {/* Spending by Category */}
            {categoryBreakdown.length > 0 && (
              <Card className="rounded-xl bg-secondary-100">
                <VStack className="gap-y-4">
                  <VStack>
                    <Text bold className="text-secondary-950 uppercase text-sm">
                      Spending by Category
                    </Text>
                    <Text className="text-sm text-secondary-950">
                      Where the money went in this range.
                    </Text>
                  </VStack>
                  <VStack className="gap-y-4">
                    {categoryBreakdown.map((row) => (
                      <VStack key={row.category} className="gap-y-2">
                        <HStack className="items-center gap-x-3">
                          <CategoryIcon
                            icon={expenseCategoryMeta(row.category).icon}
                          />
                          <Text className="flex-1 text-base" numberOfLines={1}>
                            {expenseCategoryMeta(row.category).label}
                          </Text>
                          <Text className="text-sm text-secondary-950">
                            {row.pct.toFixed(0)}%
                          </Text>
                          <Text className="text-lg font-medium">
                            {convertedCurrencies.length > 0 ? "≈ " : ""}
                            {formatAmount(row.amount, primaryCurrency)}
                          </Text>
                        </HStack>
                        {/* Same category color the budget card's bar and
                            legend use, so the two surfaces agree. */}
                        <Box className="h-1.5 rounded-full bg-secondary-200 overflow-hidden">
                          <Box
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(2, row.pct)}%`,
                              backgroundColor: expenseCategoryColor(row.category)
                            }}
                          />
                        </Box>
                      </VStack>
                    ))}
                  </VStack>
                </VStack>
              </Card>
            )}

            {/* One note for the whole tab — renders nothing when the book is
                single-currency, so the common case is untouched. */}
            <ApproxRateNote currencies={convertedCurrencies} className="px-1" />
          </VStack>
        )}
      </VStack>
    </>
  );
}

function SpendingHero({
  items,
  primaryCurrency = "PHP"
}: {
  items: { currency: string; paid: number; pending: number }[];
  primaryCurrency?: string;
}) {
  const sorted = [...items].sort((a, b) =>
    a.currency === primaryCurrency ? -1 : b.currency === primaryCurrency ? 1 : 0
  );
  const [primary] = sorted;
  const currency = primary?.currency ?? primaryCurrency;

  // Paid leads, pending rides along as the second line of each sheet row, so
  // both figures the hero shows stay reachable for the other currencies.
  const breakdown = sorted.map((t) => ({
    currency: t.currency,
    amount: t.paid,
    secondaryAmount: t.pending
  }));

  return (
    <VStack className="gap-y-2">
      <Text bold className="text-secondary-950 uppercase text-sm">
        Total Spent
      </Text>
      <HStack className="items-end justify-between">
        <VStack className="gap-y-0.5">
          <Text className="text-secondary-950 text-xs uppercase">Paid</Text>
          <Text bold className="text-3xl">
            {formatAmount(primary?.paid ?? 0, currency)}
          </Text>
        </VStack>
        <VStack className="items-end gap-y-0.5">
          <Text className="text-secondary-950 text-xs uppercase">Pending</Text>
          <Text bold className="text-xl">
            {formatAmount(primary?.pending ?? 0, currency)}
          </Text>
        </VStack>
      </HStack>
      <HStack className="items-center gap-x-2">
        <Text className="text-secondary-950 text-sm">{currency}</Text>
        <CurrencyCountButton
          items={breakdown}
          title="Total Spent"
          subtitle="Paid, by currency"
          secondaryLabel="pending"
        />
      </HStack>
    </VStack>
  );
}
