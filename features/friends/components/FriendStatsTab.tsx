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
  CustomDateRange,
  DateRangeOption,
  formatDateRangeLabel,
  getDateRangeBounds,
  isWithinRange
} from "@/features/group/components/DateRangeSheet";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { groupByCurrency } from "@/utils/currency";
import { exportFriendSettlementsAsCsv } from "@/utils/exportCsv";
import { BASE_CURRENCY, getRate, useFxRates } from "@/utils/fx";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { ChevronDown, Download } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export default function FriendStatsTab({
  userId,
  friendId,
  friendName
}: {
  userId: string;
  friendId: string;
  friendName: string;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const toast = useAppToast();
  const { details: userDetails } = states.user();
  const isPro = userDetails?.plan === "pro";
  // A friendship spans groups that may each be in a different currency, so the
  // figures that need a single yardstick fold into the app's home currency.
  const fx = useFxRates();

  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<PaymentPreview[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [customRange, setCustomRange] = useState<CustomDateRange | null>(null);
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

  const { start: cutoff, end: until } = useMemo(
    () => getDateRangeBounds(dateRange, customRange),
    [dateRange, customRange]
  );

  const filtered = useMemo(() => {
    if (!cutoff && !until) return settlements;
    return settlements.filter((s) =>
      isWithinRange(s.created_at, cutoff, until)
    );
  }, [settlements, cutoff, until]);

  const settled = useMemo(
    () => filtered.filter((s) => s.status === "settled"),
    [filtered]
  );

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

  // Count + average over EVERY settlement, with the average folded into one
  // currency so it stays a meaningful figure. An earlier version filtered to a
  // single currency instead, which silently dropped a traveller's JPY history
  // from both numbers — the count read as "settlements" but meant "PHP
  // settlements".
  //
  // The count is the true total; the average divides only by what could be
  // priced, since a settlement with no rate can't contribute to a total it
  // isn't in. So the two can disagree by a settlement in an unrated currency —
  // the count stays a fact, and the average is already flagged approximate.
  const primaryStats = useMemo(() => {
    let total = 0;
    let priced = 0;
    let approx = false;
    for (const s of settled) {
      const rate = getRate(fx, s.currency, BASE_CURRENCY);
      if (rate === null) continue;
      total += s.amount * rate;
      priced += 1;
      if (s.currency !== BASE_CURRENCY) approx = true;
    }
    return {
      count: settled.length,
      average: priced > 0 ? total / priced : 0,
      isApprox: approx
    };
  }, [settled, fx]);

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

  // Biggest settlements in range. Ranking is by CONVERTED value so a ¥5,000
  // settlement can't outrank a ₱4,000 one on its raw number, but each row still
  // displays in the currency it will actually be paid in — the yardstick is
  // approximate, the amounts on screen are not. One with no rate can't be
  // ranked at all, so it sits out rather than sorting as zero.
  const topSettlements = useMemo(
    () =>
      filtered
        .map((s) => ({ s, value: getRate(fx, s.currency, BASE_CURRENCY) }))
        .filter((r) => r.value !== null)
        .sort((a, b) => b.s.amount * b.value! - a.s.amount * a.value!)
        .slice(0, 5)
        .map((r) => r.s),
    [filtered, fx]
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
        customRange={customRange}
        onSelect={(value, custom) => {
          setDateRange(value);
          setCustomRange(custom ?? null);
        }}
      />
      <VStack className="gap-y-6 pb-6">
        {/* Date range filter pill — opens the same sheet the Settlements tab uses */}
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
                  primaryCurrency={BASE_CURRENCY}
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
                      {primaryStats.isApprox ? "≈ " : ""}
                      {formatAmount(primaryStats.average, BASE_CURRENCY)}
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
                      primaryCurrency={BASE_CURRENCY}
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
                      primaryCurrency={BASE_CURRENCY}
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

