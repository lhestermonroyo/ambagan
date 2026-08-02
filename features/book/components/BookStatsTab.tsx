import ApproxRateNote from "@/components/ApproxRateNote";
import CategoryGauge from "@/components/CategoryGauge";
import CurrencyCountButton from "@/components/CurrencyCountButton";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
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
import {
  combinedTotalLabel,
  useLinkedGroupShare
} from "@/features/group/hooks/useCombinedSpend";
import services from "@/services";
import { PersonalExpense } from "@/types/books";
import { EmptyType } from "@/types/general";
import { getRate, isConverted, useFxRates } from "@/utils/fx";
import { getPrimaryHex } from "@/utils/getColorHex";
import { ChevronDown } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export default function BookStatsTab({
  bookId,
  primaryCurrency = "PHP",
  linkedGroupId,
  linkedGroupName,
  linkedGroupCategory
}: {
  bookId: string;
  primaryCurrency?: string;
  /** Set when this book is linked to a group — turns on the combined card. */
  linkedGroupId?: string | null;
  linkedGroupName?: string | null;
  linkedGroupCategory?: string;
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
    // Book currency leads — it's the one every converted figure on this tab is
    // expressed in — then the rest by size.
    return Array.from(byCurrency.entries())
      .map(([currency, v]) => ({ currency, paid: v.paid, pending: v.pending }))
      .sort((a, b) => {
        if (a.currency === primaryCurrency) return -1;
        if (b.currency === primaryCurrency) return 1;
        return b.paid + b.pending - (a.paid + a.pending);
      });
  }, [filtered, primaryCurrency]);

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

  // Paid spend grouped by category, largest first, ready for the gauge — plus
  // the paid and pending totals it sits between. Amounts are converted into the
  // book currency (a meter has to be a single number); the percentages are
  // unaffected by that, being shares of the same converted total. Falls back to
  // "general" for any unset row.
  const spending = useMemo(() => {
    const byCategory = new Map<string, { amount: number; approx: boolean }>();
    let paidTotal = 0;
    let pendingTotal = 0;
    // Each figure is only approximate if the money behind THAT figure was
    // converted — a peso-only category, or a pending list with no foreign bills
    // in it, is exact even when the rest of the tab isn't.
    let paidApprox = false;
    let pendingApprox = false;

    for (const expense of filtered) {
      const value = inBookCurrency(expense);
      if (value === null) continue;
      const converted = isConverted(
        expense.amount,
        expense.currency,
        primaryCurrency
      );
      if (expense.status === "pending") {
        pendingTotal += value;
        pendingApprox ||= converted;
        continue;
      }
      const key = expense.category || "general";
      const entry = byCategory.get(key) ?? { amount: 0, approx: false };
      entry.amount += value;
      entry.approx ||= converted;
      byCategory.set(key, entry);
      paidTotal += value;
      paidApprox ||= converted;
    }

    const slices = Array.from(byCategory.entries())
      .map(([category, entry]) => ({
        key: category,
        label: expenseCategoryMeta(category).label,
        color: expenseCategoryColor(category),
        amount: entry.amount,
        approx: entry.approx,
        pct: paidTotal > 0 ? (entry.amount / paidTotal) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    return { slices, paidTotal, pendingTotal, paidApprox, pendingApprox };
  }, [filtered, inBookCurrency, primaryCurrency]);

  // The group half of the roll-up, when this book is linked. Expressed in the
  // BOOK's currency here — the mirror of the group Stats tab, which does the
  // same sum in the group's currency.
  const { share, loading: shareLoading } = useLinkedGroupShare(
    linkedGroupId,
    cutoff,
    until,
    primaryCurrency
  );

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
            {/* Total spent — the gauge carries both the headline figure and
                the category split, so this one card answers "how much" and
                "on what" without the two competing for the same space. The
                per-currency chip stays alongside it: the gauge is converted
                and approximate by necessity, and the exact per-currency
                figures have to stay one tap away. */}
            <Card className="rounded-xl bg-secondary-100">
              <VStack className="gap-y-4">
                <HStack className="items-center justify-between">
                  <Text bold className="text-secondary-950 uppercase text-sm">
                    Total Spent
                  </Text>
                  <HStack className="items-center gap-x-2">
                    <Text className="text-sm text-secondary-950">
                      {primaryCurrency}
                    </Text>
                    {/* Opens in convertTo mode: the gauge above shows one
                        converted figure, so the sheet has to show the exact
                        per-currency amounts, what each is worth in the book
                        currency, and a total that adds up to the gauge. Pending
                        rides along per row but stays out of that total, which is
                        paid spend only — same as the gauge. */}
                    <CurrencyCountButton
                      items={totalsByCurrency.map((t) => ({
                        currency: t.currency,
                        amount: t.paid,
                        secondaryAmount: t.pending
                      }))}
                      title="Total Spent"
                      subtitle="Paid, by currency"
                      secondaryLabel="pending"
                      convertTo={primaryCurrency}
                      totalLabel="Total paid"
                    />
                  </HStack>
                </HStack>

                <CategoryGauge
                  slices={spending.slices}
                  total={spending.paidTotal}
                  currency={primaryCurrency}
                  approx={spending.paidApprox}
                />

                <Divider />
                <HStack className="items-stretch">
                  <VStack className="flex-1 gap-y-1">
                    <Text className="text-sm text-secondary-950 uppercase">
                      Pending
                    </Text>
                    <Text
                      bold
                      className="text-lg"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {spending.pendingApprox ? "≈ " : ""}
                      {formatAmount(spending.pendingTotal, primaryCurrency)}
                    </Text>
                  </VStack>
                  <Divider orientation="vertical" className="mx-3" />
                  <VStack className="flex-1 gap-y-1">
                    <Text className="text-sm text-secondary-950 uppercase">
                      Expenses
                    </Text>
                    <Text bold className="text-lg">
                      {primaryStats.count}
                    </Text>
                  </VStack>
                  <Divider orientation="vertical" className="mx-3" />
                  <VStack className="flex-1 gap-y-1">
                    <Text className="text-sm text-secondary-950 uppercase">
                      Avg
                    </Text>
                    <Text
                      bold
                      className="text-lg"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {convertedCurrencies.length > 0 ? "≈ " : ""}
                      {formatAmount(primaryStats.average, primaryCurrency)}
                    </Text>
                  </VStack>
                </HStack>
              </VStack>
            </Card>

            {/* Combined with the linked group — the mirror of the card on that
                group's Stats tab, in the BOOK's currency instead of the group's.
                Same rule as there: two lines that visibly sum, never one blended
                figure, so a double-logged expense stays findable. */}
            {linkedGroupId && (
              <Card className="rounded-xl bg-secondary-100">
                <VStack className="gap-y-4">
                  <VStack>
                    <Text bold className="text-secondary-950 uppercase text-sm">
                      {combinedTotalLabel(linkedGroupCategory)}
                    </Text>
                    <Text className="text-sm text-secondary-950">
                      This book plus your share of{" "}
                      {linkedGroupName ?? "the linked group"}.
                    </Text>
                  </VStack>

                  <VStack className="gap-y-2">
                    <HStack className="items-center justify-between gap-x-3">
                      <Text
                        className="text-sm text-secondary-950 flex-1"
                        numberOfLines={1}
                      >
                        This book (paid)
                      </Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit>
                        {spending.paidApprox ? "≈ " : ""}
                        {formatAmount(spending.paidTotal, primaryCurrency)}
                      </Text>
                    </HStack>
                    <HStack className="items-center justify-between gap-x-3">
                      <Text
                        className="text-sm text-secondary-950 flex-1"
                        numberOfLines={1}
                      >
                        Your share (group)
                      </Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit>
                        {shareLoading
                          ? "—"
                          : `${share.approx ? "≈ " : ""}${formatAmount(share.amount, primaryCurrency)}`}
                      </Text>
                    </HStack>
                    <Divider />
                    <HStack className="items-center justify-between">
                      <Text bold>{combinedTotalLabel(linkedGroupCategory)}</Text>
                      <Text
                        bold
                        className="text-lg"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {shareLoading
                          ? "—"
                          : `${spending.paidApprox || share.approx ? "≈ " : ""}${formatAmount(
                              spending.paidTotal + share.amount,
                              primaryCurrency
                            )}`}
                      </Text>
                    </HStack>
                  </VStack>

                  <Text className="text-sm text-secondary-950">
                    Your share is what you consumed, not what you fronted — money
                    you paid for others nets out when the group settles.
                  </Text>
                </VStack>
              </Card>
            )}

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
                      <HStack key={expense.id} className="items-center gap-x-3">
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

            {/* One note for the whole tab — renders nothing when the book is
                single-currency, so the common case is untouched. */}
            <ApproxRateNote currencies={convertedCurrencies} className="px-1" />
          </VStack>
        )}
      </VStack>
    </>
  );
}
