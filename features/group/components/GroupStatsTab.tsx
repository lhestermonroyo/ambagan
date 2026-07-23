import CategoryIcon from "@/components/CategoryIcon";
import FormButton from "@/components/FormButton";
import UpgradeSheet from "@/components/UpgradeSheet";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { expenseCategoryMeta } from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import DateRangeSheet, {
  DateRangeOption,
  dateRangeLabels,
  getDateRangeCutoff
} from "@/features/group/components/DateRangeSheet";
import GroupMemberBreakdown from "@/features/group/components/GroupMemberBreakdown";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { groupByCurrency } from "@/utils/currency";
import { exportGroupSettlementsAsCsv } from "@/utils/exportCsv";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { ChevronDown, Download } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export default function GroupStatsTab({
  groupId,
  groupName,
  userId
}: {
  groupId: string;
  groupName: string;
  userId: string;
}) {
  const { expenseList, settlementList } = states.group();
  const { defaultCurrency, details: userDetails } = states.user();
  const isPro = userDetails?.plan === "pro";
  const toast = useAppToast();
  const colorScheme = useColorScheme() ?? "light";

  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);

  const cutoff = useMemo(() => getDateRangeCutoff(dateRange), [dateRange]);

  const filteredExpenses = useMemo(() => {
    if (!cutoff) return expenseList;
    return expenseList.filter((e) => new Date(e.created_at) >= cutoff);
  }, [expenseList, cutoff]);

  const filteredActivePayments = useMemo(() => {
    const active = settlementList.filter((p) => p.status !== "settled");
    if (!cutoff) return active;
    return active.filter((p) => new Date(p.created_at) >= cutoff);
  }, [settlementList, cutoff]);

  const totalSpendingsByCurrency = useMemo(
    () => groupByCurrency(filteredExpenses),
    [filteredExpenses]
  );

  const toCollect = useMemo(
    () =>
      groupByCurrency(
        filteredActivePayments.filter((p) => p.payer.id === userId)
      ),
    [filteredActivePayments, userId]
  );

  const toPay = useMemo(
    () =>
      groupByCurrency(
        filteredActivePayments.filter((p) => p.member.id === userId)
      ),
    [filteredActivePayments, userId]
  );

  const netBalance = useMemo(() => {
    const allCurrencies = new Set([
      ...toCollect.map((i) => i.currency),
      ...toPay.map((i) => i.currency)
    ]);
    return Array.from(allCurrencies).map((currency) => {
      const receive =
        toCollect.find((i) => i.currency === currency)?.amount ?? 0;
      const pay = toPay.find((i) => i.currency === currency)?.amount ?? 0;
      return { currency, amount: receive - pay };
    });
  }, [toCollect, toPay]);

  // Count + average, scoped to the primary currency so the average stays a
  // meaningful figure (averaging across currencies would be nonsense). Kept
  // consistent with the Total Group Spendings hero, which also leads with the
  // primary-currency total.
  const primaryStats = useMemo(() => {
    const inCurrency = filteredExpenses.filter(
      (e) => e.currency === defaultCurrency
    );
    const count = inCurrency.length;
    const total = inCurrency.reduce((sum, e) => sum + e.amount, 0);
    return { count, average: count > 0 ? total / count : 0 };
  }, [filteredExpenses, defaultCurrency]);

  // Biggest expenses in range. Scoped to the primary currency too — ranking a
  // ¥5,000 expense above a ₱4,000 one by raw amount would be misleading. Drafts
  // are excluded (they aren't real posted spending yet).
  const topExpenses = useMemo(
    () =>
      filteredExpenses
        .filter((e) => !e.is_draft && e.currency === defaultCurrency)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [filteredExpenses, defaultCurrency]
  );

  // Spending grouped by category (primary currency, drafts excluded), largest
  // first, with each slice's share of the total. Falls back to "other" for any
  // legacy/unset row so the total always reconciles with the spending hero.
  const categoryBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    let total = 0;
    filteredExpenses
      .filter((e) => !e.is_draft && e.currency === defaultCurrency)
      .forEach((e) => {
        const key = e.category || "other";
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
  }, [filteredExpenses, defaultCurrency]);

  const handleExport = async () => {
    if (!isPro) {
      setUpgradeSheetOpen(true);
      return;
    }
    setExporting(true);
    try {
      const payments = await services.expense.getPaymentsForExport(
        groupId,
        userId,
        cutoff
      );

      if (payments.length === 0) {
        toast({
          title: "No data",
          description: "No settlements found for the selected date range.",
          type: "info"
        });
        return;
      }

      await exportGroupSettlementsAsCsv(payments, groupName);
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export failed",
        description: "Could not export settlements. Please try again.",
        type: "error"
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <UpgradeSheet
        isOpen={upgradeSheetOpen}
        onClose={() => setUpgradeSheetOpen(false)}
        description="CSV export is a Pro feature. Upgrade once to export settlements anytime."
      />
      <DateRangeSheet
        isOpen={dateRangeSheetOpen}
        onClose={() => setDateRangeSheetOpen(false)}
        dateRange={dateRange}
        onSelect={setDateRange}
      />
      <VStack className="gap-y-6 pb-6">
        {/* Date range filter pill — opens the same sheet the Settlements tab uses */}
        <HStack className="px-4">
          <FormButton
            size="sm"
            variant="outline"
            text={dateRangeLabels[dateRange]}
            iconEnd={
              <ChevronDown
                size={16}
                color={getPrimaryHex("text-primary-500", colorScheme)}
              />
            }
            onPress={() => setDateRangeSheetOpen(true)}
          />
        </HStack>

        <VStack className="px-4 gap-y-4">
          {/* Total Group Spendings */}
          <Card className="rounded-xl bg-secondary-100">
            <VStack className="gap-y-4">
              <SpendingHero
                items={totalSpendingsByCurrency}
                primaryCurrency={defaultCurrency}
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
                    {formatAmount(primaryStats.average, defaultCurrency)}
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          </Card>

          {/* Per-member paid vs. share breakdown */}
          <GroupMemberBreakdown
            expenses={filteredExpenses}
            userId={userId}
            primaryCurrency={defaultCurrency}
          />

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
                  {topExpenses.map((expense, index) => {
                    const lead = expense.payer_list[0]?.payer;
                    const leadName = lead
                      ? lead.id === userId
                        ? `${lead.first_name} (You)`
                        : lead.first_name
                      : "";
                    const others = expense.payer_list.length - 1;
                    const payerLabel =
                      others > 0 ? `${leadName} +${others}` : leadName;

                    return (
                      <HStack key={expense.id} className="items-center gap-x-3">
                        <Text className="w-4 text-sm text-secondary-950">
                          {index + 1}
                        </Text>
                        <VStack className="flex-1">
                          <Text numberOfLines={1}>{expense.description}</Text>
                          {payerLabel ? (
                            <Text
                              className="text-sm text-secondary-950"
                              numberOfLines={1}
                            >
                              Paid by {payerLabel}
                            </Text>
                          ) : null}
                        </VStack>
                        <Text className="text-lg">
                          {formatAmount(expense.amount, expense.currency)}
                        </Text>
                      </HStack>
                    );
                  })}
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
                      <HStack className="items-center gap-x-2">
                        <CategoryIcon
                          icon={expenseCategoryMeta(row.category).icon}
                        />
                        <Text className="flex-1 text-base" numberOfLines={1}>
                          {expenseCategoryMeta(row.category).label}
                        </Text>
                        <Text className="text-sm text-secondary-950">
                          {row.pct.toFixed(0)}%
                        </Text>
                        <Text className="text-lg">
                          {formatAmount(row.amount, defaultCurrency)}
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

          {/* Export */}
          <VStack className="gap-y-4">
            <VStack className="gap-y-2">
              <Text bold className="text-secondary-950 uppercase">
                Export Settlements
              </Text>
              <Text className="text-sm text-secondary-950">
                The CSV includes all settlements you're involved in for this
                group within the selected date range — settlement ID, date,
                payer, member, amount, currency, and status.
              </Text>
            </VStack>
            <FormButton
              text={isPro ? "Export CSV" : "Export CSV — Pro"}
              icon={
                <Download
                  size={18}
                  color={getSecondaryHex("text-secondary-0", colorScheme)}
                />
              }
              loading={exporting}
              onPress={handleExport}
            />
          </VStack>
        </VStack>
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
        Total Group Spendings
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

function NetBalanceHero({
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

  const amountColor = primaryAmount < 0 && "text-error-400";

  return (
    <VStack className="gap-y-2">
      <Text bold className="text-secondary-950 uppercase text-sm">
        Net Balance
      </Text>
      <HStack className="items-end gap-x-2">
        <Text bold className={`text-3xl ${amountColor}`}>
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
