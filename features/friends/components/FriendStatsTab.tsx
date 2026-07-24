import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import { SettlementListSkeleton } from "@/components/SkeletonLoader";
import UpgradeSheet from "@/components/UpgradeSheet";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import DateRangeSheet, {
  DateRangeOption,
  dateRangeLabels,
  getDateRangeCutoff
} from "@/features/group/components/DateRangeSheet";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { groupByCurrency } from "@/utils/currency";
import { exportFriendSettlementsAsCsv } from "@/utils/exportCsv";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { ChevronDown, Download } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export default function FriendStatsTab({
  userId,
  friendId,
  friendName,
  defaultCurrency = "PHP"
}: {
  userId: string;
  friendId: string;
  friendName: string;
  defaultCurrency?: string;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const toast = useAppToast();
  const { details: userDetails } = states.user();
  const isPro = userDetails?.plan === "pro";

  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<PaymentPreview[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);

  // The Settlements tab paginates its "settled" history, so it only ever holds
  // a page of it. Stats want the whole relationship, so fetch the full pair
  // ledger once here (all statuses) and derive everything from it.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    services.friend
      .getFriendSettlements(userId, friendId)
      .then((data) => {
        if (!cancelled) setSettlements(data);
      })
      .catch((error) => {
        console.error("Failed to load friend stats:", error);
        if (!cancelled) setSettlements([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, friendId]);

  const cutoff = useMemo(() => getDateRangeCutoff(dateRange), [dateRange]);

  const filtered = useMemo(() => {
    if (!cutoff) return settlements;
    return settlements.filter((s) => new Date(s.created_at) >= cutoff);
  }, [settlements, cutoff]);

  const active = useMemo(
    () => filtered.filter((s) => s.status !== "settled"),
    [filtered]
  );
  const settled = useMemo(
    () => filtered.filter((s) => s.status === "settled"),
    [filtered]
  );

  // Outstanding — pending/requested only, netted per currency.
  const toCollect = useMemo(
    () => groupByCurrency(active.filter((s) => s.payer.id === userId)),
    [active, userId]
  );
  const toPay = useMemo(
    () => groupByCurrency(active.filter((s) => s.member.id === userId)),
    [active, userId]
  );
  const netBalance = useMemo(() => {
    const currencies = new Set([
      ...toCollect.map((i) => i.currency),
      ...toPay.map((i) => i.currency)
    ]);
    return Array.from(currencies).map((currency) => {
      const receive =
        toCollect.find((i) => i.currency === currency)?.amount ?? 0;
      const pay = toPay.find((i) => i.currency === currency)?.amount ?? 0;
      return { currency, amount: receive - pay };
    });
  }, [toCollect, toPay]);

  // Lifetime settled — money that has actually changed hands between the two.
  const totalSettled = useMemo(() => groupByCurrency(settled), [settled]);
  const collected = useMemo(
    () => groupByCurrency(settled.filter((s) => s.payer.id === userId)),
    [settled, userId]
  );
  const paid = useMemo(
    () => groupByCurrency(settled.filter((s) => s.member.id === userId)),
    [settled, userId]
  );

  // Count + average, scoped to the primary currency so the average stays a
  // meaningful figure (averaging across currencies would be nonsense).
  const primaryStats = useMemo(() => {
    const inCurrency = settled.filter((s) => s.currency === defaultCurrency);
    const count = inCurrency.length;
    const total = inCurrency.reduce((sum, s) => sum + s.amount, 0);
    return { count, average: count > 0 ? total / count : 0 };
  }, [settled, defaultCurrency]);

  // Status mix across the filtered range, with each slice's share of the total.
  const statusBreakdown = useMemo(() => {
    const counts = {
      pending: 0,
      requested: 0,
      settled: 0
    };
    filtered.forEach((s) => {
      if (s.status === "pending") counts.pending += 1;
      else if (s.status === "requested") counts.requested += 1;
      else if (s.status === "settled") counts.settled += 1;
    });
    const total = filtered.length;
    return [
      { label: "Pending", count: counts.pending },
      { label: "Requested", count: counts.requested },
      { label: "Settled", count: counts.settled }
    ]
      .filter((row) => row.count > 0)
      .map((row) => ({
        ...row,
        pct: total > 0 ? (row.count / total) * 100 : 0
      }));
  }, [filtered]);

  // Biggest settlements in range, scoped to the primary currency — ranking a
  // ¥5,000 settlement above a ₱4,000 one by raw amount would be misleading.
  const topSettlements = useMemo(
    () =>
      filtered
        .filter((s) => s.currency === defaultCurrency)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [filtered, defaultCurrency]
  );

  // Distinct groups the two of you share expenses in, over the range.
  const sharedGroups = useMemo(
    () => new Set(filtered.map((s) => s.group_id).filter(Boolean)).size,
    [filtered]
  );

  const handleExport = async () => {
    if (!isPro) {
      setUpgradeSheetOpen(true);
      return;
    }
    setExporting(true);
    try {
      const payments = await services.friend.getFriendPaymentsForExport(
        userId,
        friendId,
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

      await exportFriendSettlementsAsCsv(payments, friendName);
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

  if (loading) {
    return (
      <VStack className="pt-2">
        <SettlementListSkeleton />
      </VStack>
    );
  }

  if (settlements.length === 0) {
    return (
      <VStack className="pt-6">
        <EmptyList type={EmptyType.SETTLEMENT_ALL} />
      </VStack>
    );
  }

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

        {filtered.length === 0 ? (
          <EmptyList
            type={EmptyType.SETTLEMENT_ALL}
            content="No settlements with this friend in the selected date range."
          />
        ) : (
          <VStack className="px-4 gap-y-4">
            {/* Lifetime settled */}
            <Card className="rounded-xl bg-secondary-100">
              <VStack className="gap-y-4">
                <SettledHero
                  items={totalSettled}
                  primaryCurrency={defaultCurrency}
                />
                <Divider />
                <HStack className="items-stretch">
                  <VStack className="flex-1 gap-y-1">
                    <Text className="text-sm text-secondary-950 uppercase">
                      Settlements
                    </Text>
                    <Text bold className="text-lg">
                      {primaryStats.count}
                    </Text>
                  </VStack>
                  <Divider orientation="vertical" className="mx-4" />
                  <VStack className="flex-1 gap-y-1">
                    <Text className="text-sm text-secondary-950 uppercase">
                      Avg / Settlement
                    </Text>
                    <Text bold className="text-lg">
                      {formatAmount(primaryStats.average, defaultCurrency)}
                    </Text>
                  </VStack>
                </HStack>
              </VStack>
            </Card>

            {/* Money flow — direction of settled money over the relationship */}
            <Card className="rounded-xl bg-secondary-100">
              <VStack className="gap-y-4">
                <VStack>
                  <Text bold className="text-secondary-950 uppercase text-sm">
                    Money Flow
                  </Text>
                  <Text className="text-sm text-secondary-950">
                    Settled amounts that changed hands.
                  </Text>
                </VStack>
                <HStack className="items-stretch">
                  <VStack className="flex-1 gap-y-1">
                    <Text className="text-sm text-secondary-950 uppercase">
                      You Collected
                    </Text>
                    <CurrencyAmountDisplay
                      items={collected}
                      label="You Collected"
                      type="receive"
                      primaryCurrency={defaultCurrency}
                    />
                  </VStack>
                  <Divider orientation="vertical" className="mx-4" />
                  <VStack className="flex-1 gap-y-1">
                    <Text className="text-sm text-secondary-950 uppercase">
                      You Paid
                    </Text>
                    <CurrencyAmountDisplay
                      items={paid}
                      label="You Paid"
                      type="pay"
                      primaryCurrency={defaultCurrency}
                    />
                  </VStack>
                </HStack>
                {sharedGroups > 0 && (
                  <>
                    <Divider />
                    <HStack className="items-center justify-between">
                      <Text className="text-sm text-secondary-950 uppercase">
                        Shared Groups
                      </Text>
                      <Text bold className="text-lg">
                        {sharedGroups}
                      </Text>
                    </HStack>
                  </>
                )}
              </VStack>
            </Card>

            {/* Activity mix by status */}
            {statusBreakdown.length > 0 && (
              <Card className="rounded-xl bg-secondary-100">
                <VStack className="gap-y-4">
                  <VStack>
                    <Text bold className="text-secondary-950 uppercase text-sm">
                      Activity
                    </Text>
                    <Text className="text-sm text-secondary-950">
                      Settlements by status in this range.
                    </Text>
                  </VStack>
                  <VStack className="gap-y-4">
                    {statusBreakdown.map((row) => (
                      <VStack key={row.label} className="gap-y-2">
                        <HStack className="items-center gap-x-3">
                          <Text className="flex-1 text-base">{row.label}</Text>
                          <Text className="text-sm text-secondary-950">
                            {row.pct.toFixed(0)}%
                          </Text>
                          <Text className="text-lg font-medium">
                            {row.count}
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

            {/* Top settlements */}
            {topSettlements.length > 0 && (
              <Card className="rounded-xl bg-secondary-100">
                <VStack className="gap-y-4">
                  <VStack>
                    <Text bold className="text-secondary-950 uppercase text-sm">
                      Top Settlements
                    </Text>
                    <Text className="text-sm text-secondary-950">
                      Biggest settlements in this range.
                    </Text>
                  </VStack>
                  <VStack className="gap-y-3">
                    {topSettlements.map((settlement, index) => {
                      const userIsPayer = settlement.payer.id === userId;
                      const directionLabel = userIsPayer
                        ? `${friendName} owes you`
                        : `You owe ${friendName}`;
                      return (
                        <HStack
                          key={settlement.id}
                          className="items-center gap-x-3"
                        >
                          <Text className="w-4 text-sm text-secondary-950">
                            {index + 1}
                          </Text>
                          <VStack className="flex-1">
                            <Text numberOfLines={1}>
                              {settlement.expense_description ?? "Settlement"}
                            </Text>
                            <Text
                              className="text-sm text-secondary-950"
                              numberOfLines={1}
                            >
                              {directionLabel}
                            </Text>
                          </VStack>
                          <Text className="text-lg font-medium">
                            {formatAmount(
                              settlement.amount,
                              settlement.currency
                            )}
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
                  The CSV includes every settlement between you and {friendName}{" "}
                  within the selected date range — settlement ID, recorded and
                  expense dates, description, category, payer, member, amount,
                  currency, status, request/settle timestamps, and notes.
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
        )}
      </VStack>
    </>
  );
}

function SettledHero({
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
        Total Settled
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

function NetHero({
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
  const amountColor = primaryAmount < 0 ? "text-error-400" : undefined;

  return (
    <VStack className="gap-y-2">
      <Text bold className="text-secondary-950 uppercase text-sm">
        Net Balance
      </Text>
      <HStack className="items-end gap-x-2">
        <Text bold className={`text-3xl ${amountColor ?? ""}`}>
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
