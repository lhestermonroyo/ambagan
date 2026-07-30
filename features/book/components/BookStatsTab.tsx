import CategoryIcon from "@/components/CategoryIcon";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { groupCategoryMeta } from "@/features/expense/components/CategorySheet";
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
import { getPrimaryHex } from "@/utils/getColorHex";
import { ChevronDown } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export default function BookStatsTab({
  bookId,
  primaryCurrency = "PHP"
}: {
  bookId: string;
  primaryCurrency?: string;
}) {
  const colorScheme = useColorScheme() ?? "light";

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

  // Total spent, per currency (a trip book can mix PHP + JPY). Never converted —
  // each currency is its own line, matching the Expenses-tab hero.
  const totalsByCurrency = useMemo(() => {
    const byCurrency = new Map<string, number>();
    filtered.forEach((e) => {
      const currency = e.currency || "PHP";
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + e.amount);
    });
    return Array.from(byCurrency.entries())
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  // Count + average, scoped to the primary currency so the average stays a
  // meaningful figure (averaging across currencies would be nonsense).
  const primaryStats = useMemo(() => {
    const inCurrency = filtered.filter((e) => e.currency === primaryCurrency);
    const count = inCurrency.length;
    const total = inCurrency.reduce((sum, e) => sum + e.amount, 0);
    return { count, average: count > 0 ? total / count : 0 };
  }, [filtered, primaryCurrency]);

  // Biggest expenses in range, scoped to the primary currency — ranking a
  // ¥5,000 expense above a ₱4,000 one by raw amount would be misleading.
  const topExpenses = useMemo(
    () =>
      filtered
        .filter((e) => e.currency === primaryCurrency)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [filtered, primaryCurrency]
  );

  // Spending grouped by category (primary currency), largest first, with each
  // slice's share of the total. Falls back to "general" for any unset row so the
  // total always reconciles with the spending hero.
  const categoryBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    let total = 0;
    filtered
      .filter((e) => e.currency === primaryCurrency)
      .forEach((e) => {
        const key = e.category || "general";
        byCategory.set(key, (byCategory.get(key) ?? 0) + e.amount);
        total += e.amount;
      });

    return Array.from(byCategory.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered, primaryCurrency]);

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
                      Biggest expenses in this range.
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
                            {groupCategoryMeta(expense.category).label}
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
                            icon={groupCategoryMeta(row.category).icon}
                          />
                          <Text className="flex-1 text-base" numberOfLines={1}>
                            {groupCategoryMeta(row.category).label}
                          </Text>
                          <Text className="text-sm text-secondary-950">
                            {row.pct.toFixed(0)}%
                          </Text>
                          <Text className="text-lg font-medium">
                            {formatAmount(row.amount, primaryCurrency)}
                          </Text>
                        </HStack>
                        <Box className="h-1.5 rounded-full bg-secondary-200 overflow-hidden">
                          <Box
                            className="h-full rounded-full bg-primary-500"
                            style={{ width: `${Math.max(2, row.pct)}%` }}
                          />
                        </Box>
                      </VStack>
                    ))}
                  </VStack>
                </VStack>
              </Card>
            )}
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
  items: { currency: string; amount: number }[];
  primaryCurrency?: string;
}) {
  const sorted = [...items].sort((a, b) =>
    a.currency === primaryCurrency ? -1 : b.currency === primaryCurrency ? 1 : 0
  );
  const [primary, ...secondary] = sorted;
  const primaryAmount = primary?.amount ?? 0;

  return (
    <VStack className="gap-y-2">
      <Text bold className="text-secondary-950 uppercase text-sm">
        Total Spent
      </Text>
      <HStack className="items-end gap-x-2">
        <Text bold className="text-3xl">
          {formatAmount(primaryAmount, primary?.currency ?? primaryCurrency)}
        </Text>
        <HStack className="items-center gap-x-1 pb-1">
          <Text className="text-secondary-950 text-base">
            {primary?.currency ?? primaryCurrency}
          </Text>
          {secondary.length > 0 && (
            <Text className="text-secondary-950 text-sm">
              +{secondary.length} more
            </Text>
          )}
        </HStack>
      </HStack>
    </VStack>
  );
}
