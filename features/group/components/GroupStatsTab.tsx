import ApproxRateNote from "@/components/ApproxRateNote";
import CategoryGauge from "@/components/CategoryGauge";
import CurrencyCountButton from "@/components/CurrencyCountButton";
import FormButton from "@/components/FormButton";
import UpgradeSheet from "@/components/UpgradeSheet";
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
import GroupMemberBreakdown from "@/features/group/components/GroupMemberBreakdown";
import GroupPersonalStats from "@/features/group/components/GroupPersonalStats";
import { useMemberSplits } from "@/features/group/hooks/useMemberSplits";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { groupByCurrency } from "@/utils/currency";
import { exportGroupSettlementsAsCsv } from "@/utils/exportCsv";
import {
  BASE_CURRENCY,
  isConverted,
  useConverter,
  useForeignCurrencies
} from "@/utils/fx";
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
  const { expenseList, details: groupDetails } = states.group();
  const { details: userDetails } = states.user();
  const isPro = userDetails?.plan === "pro";

  // The group's own home currency is the one every card leads with (a JPY trip
  // group must scope its stats to JPY — else the primary-currency cards would
  // come up empty). Falls back to the app's home currency for legacy rows /
  // until the detail loads.
  const primaryCurrency = groupDetails?.currency ?? BASE_CURRENCY;
  const toast = useAppToast();
  const colorScheme = useColorScheme() ?? "light";

  // "Group" (default) vs. "You" — a segmented toggle swaps the whole card set
  // between the shared group view and the current user's personal figures. Both
  // read the same date range and the same fetched-once member splits.
  const [statsView, setStatsView] = useState<"You" | "Group">("Group");
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [customRange, setCustomRange] = useState<CustomDateRange | null>(null);
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);

  const { start: cutoff, end: until } = useMemo(
    () => getDateRangeBounds(dateRange, customRange),
    [dateRange, customRange]
  );

  const filteredExpenses = useMemo(() => {
    if (!cutoff && !until) return expenseList;
    return expenseList.filter((e) =>
      isWithinRange(e.created_at, cutoff, until)
    );
  }, [expenseList, cutoff, until]);

  // Member splits for the filtered expenses, fetched once and shared by the
  // personal "Your Activity" card and the group Member Breakdown below.
  const { splits, loading: splitsLoading } = useMemberSplits(filteredExpenses);

  // Drafts aren't posted spending yet, so nothing on this tab counts them. This
  // used to be applied per-card, which let the spending hero include drafts
  // while the category split below it didn't — the two never reconciled.
  const posted = useMemo(
    () => filteredExpenses.filter((e) => !e.is_draft),
    [filteredExpenses]
  );

  // Per-currency totals behind the card's "+N" chip. Primary currency leads —
  // it's the one the gauge and every stat under it are expressed in. These stay
  // EXACT and unconverted: they're the working behind the converted figures.
  const totalSpendingsByCurrency = useMemo(
    () =>
      groupByCurrency(posted).sort((a, b) => {
        if (a.currency === primaryCurrency) return -1;
        if (b.currency === primaryCurrency) return 1;
        return b.amount - a.amount;
      }),
    [posted, primaryCurrency]
  );

  // Every figure on this tab is expressed in the group's own currency, with
  // foreign spend converted in at display time — a ¥ expense in a PHP group is
  // still that group's money and has to count. Anything we hold no rate for is
  // left out entirely rather than counted as zero, so a total is understated
  // rather than wrong.
  const convert = useConverter(primaryCurrency);
  const convertedCurrencies = useForeignCurrencies(posted, primaryCurrency);
  const approx = convertedCurrencies.length > 0;

  // Count + average across every currency, converted so the average stays a
  // single meaningful figure. Count is of expenses actually priced, so it can't
  // disagree with the average's denominator.
  const primaryStats = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const e of posted) {
      const value = convert(e.amount, e.currency);
      if (value === null) continue;
      count += 1;
      total += value;
    }
    return { count, average: count > 0 ? total / count : 0 };
  }, [posted, convert]);

  // Biggest expenses in range. RANKED by converted value so a ¥5,000 expense
  // sorts correctly against a ₱4,000 one — but each row still renders in its own
  // currency, so the number on screen stays exact and only the ordering relies
  // on a rate.
  const topExpenses = useMemo(
    () =>
      posted
        .filter((e) => convert(e.amount, e.currency) !== null)
        .sort(
          (a, b) =>
            (convert(b.amount, b.currency) ?? 0) -
            (convert(a.amount, a.currency) ?? 0)
        )
        .slice(0, 5),
    [posted, convert]
  );

  // Paid spend grouped by category, largest first, ready for the gauge — plus
  // the total it's measured against. Amounts are converted into the group
  // currency (a meter has to be a single number); the percentages are unaffected
  // by that, being shares of the same converted total. Falls back to "other" for
  // any legacy/unset row so the slices always sum back to that total.
  const spending = useMemo(() => {
    const byCategory = new Map<string, { amount: number; approx: boolean }>();
    let total = 0;
    posted.forEach((e) => {
      const value = convert(e.amount, e.currency);
      if (value === null) return;
      const key = e.category || "other";
      const entry = byCategory.get(key) ?? { amount: 0, approx: false };
      entry.amount += value;
      // Tracked per category, not once for the tab: a transport slice paid for
      // entirely in pesos is exact, and saying "≈" on it because the food slice
      // had yen in it makes the whole legend look estimated.
      entry.approx ||= isConverted(e.amount, e.currency, primaryCurrency);
      byCategory.set(key, entry);
      total += value;
    });

    const slices = Array.from(byCategory.entries())
      .map(([category, entry]) => ({
        key: category,
        label: expenseCategoryMeta(category).label,
        color: expenseCategoryColor(category),
        amount: entry.amount,
        approx: entry.approx,
        pct: total > 0 ? (entry.amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    return { slices, total };
  }, [posted, convert, primaryCurrency]);

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
        cutoff,
        until
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
        customRange={customRange}
        onSelect={(value, custom) => {
          setDateRange(value);
          setCustomRange(custom ?? null);
        }}
      />
      <VStack className="gap-y-6 pb-6">
        {/* You | Group segmented toggle + the date-range pill (opens the same
            sheet the Settlements tab uses). The toggle swaps which card set
            renders; the date range applies to whichever view is active. */}
        <HStack className="px-4 items-center justify-between">
          <HStack className="gap-x-2">
            <FormButton
              size="sm"
              variant={statsView === "Group" ? "solid" : "outline"}
              text="Group"
              onPress={() => setStatsView("Group")}
            />
            <FormButton
              size="sm"
              variant={statsView === "You" ? "solid" : "outline"}
              text="You"
              onPress={() => setStatsView("You")}
            />
          </HStack>
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

        <VStack className="px-4 gap-y-4">
          {statsView === "You" && (
            /* Your Activity — personal summary for the selected range, leading
               with the current user's own share / paid / net. */
            <GroupPersonalStats
              expenses={filteredExpenses}
              splits={splits}
              loading={splitsLoading}
              userId={userId}
              groupId={groupId}
              groupCategory={groupDetails?.category}
              cutoff={cutoff}
              until={until}
              primaryCurrency={primaryCurrency}
            />
          )}

          {statsView === "Group" && (
            <>
              {/* Total Group Spendings — the gauge carries both the headline
                  figure and the category split, so this one card answers "how
                  much" and "on what" instead of the two competing for the same
                  space. The per-currency chip stays alongside it: the gauge is
                  scoped to the primary currency, so a mixed-currency group
                  needs the exact per-currency figures one tap away. */}
              <Card className="rounded-xl bg-secondary-100">
                <VStack className="gap-y-4">
                  <HStack className="items-center justify-between">
                    <Text bold className="text-secondary-950 uppercase text-sm">
                      Total Group Spendings
                    </Text>
                    <HStack className="items-center gap-x-2">
                      <Text className="text-sm text-secondary-950">
                        {primaryCurrency}
                      </Text>
                      {/* Opens in convertTo mode: the gauge above shows one
                          converted figure, so the sheet has to show the exact
                          per-currency amounts, what each is worth in the group
                          currency, and a total that adds up to the gauge. */}
                      <CurrencyCountButton
                        items={totalSpendingsByCurrency}
                        title="Total Group Spendings"
                        subtitle="Total, by currency"
                        convertTo={primaryCurrency}
                        totalLabel="Total spent"
                      />
                    </HStack>
                  </HStack>

                  <CategoryGauge
                    slices={spending.slices}
                    total={spending.total}
                    currency={primaryCurrency}
                    approx={approx}
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
                      <Text
                        bold
                        className="text-lg"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {approx ? "≈ " : ""}
                        {formatAmount(primaryStats.average, primaryCurrency)}
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              </Card>

              {/* Per-member paid vs. share breakdown */}
              <GroupMemberBreakdown
                expenses={filteredExpenses}
                splits={splits}
                loading={splitsLoading}
                userId={userId}
                primaryCurrency={primaryCurrency}
              />

              {/* Top Expenses */}
              {topExpenses.length > 0 && (
                <Card className="rounded-xl bg-secondary-100">
                  <VStack className="gap-y-4">
                    <VStack>
                      <Text
                        bold
                        className="text-secondary-950 uppercase text-sm"
                      >
                        Top Expenses
                      </Text>
                      <Text className="text-sm text-secondary-950">
                        {approx
                          ? "Biggest expenses in this range, ranked across currencies."
                          : "Biggest expenses in this range."}
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
                          <HStack
                            key={expense.id}
                            className="items-center gap-x-3"
                          >
                            <Text className="w-4 text-sm text-secondary-950">
                              {index + 1}
                            </Text>
                            <VStack className="flex-1">
                              <Text numberOfLines={1}>
                                {expense.description}
                              </Text>
                              {payerLabel ? (
                                <Text
                                  className="text-sm text-secondary-950"
                                  numberOfLines={1}
                                >
                                  Paid by {payerLabel}
                                </Text>
                              ) : null}
                            </VStack>
                            <Text className="text-lg font-medium">
                              {formatAmount(expense.amount, expense.currency)}
                            </Text>
                          </HStack>
                        );
                      })}
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
                    group within the selected date range — settlement ID,
                    recorded and expense dates, description, category, payer,
                    member, amount, currency, status, request/settle timestamps,
                    and notes.
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
            </>
          )}

          {/* One note for the whole tab — both views convert the same way, and
              it renders nothing when the group is single-currency, so the common
              case is untouched. */}
          <ApproxRateNote currencies={convertedCurrencies} className="px-1" />
        </VStack>
      </VStack>
    </>
  );
}
