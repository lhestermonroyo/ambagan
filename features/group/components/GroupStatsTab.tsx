import FormButton from "@/components/FormButton";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  DateRangeOption,
  dateRangeOptions,
  getDateRangeCutoff
} from "@/features/group/components/DateRangeSheet";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { groupByCurrency } from "@/utils/currency";
import { exportGroupSettlementsAsCsv } from "@/utils/exportCsv";
import { useMemo, useState } from "react";

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
  const { defaultCurrency } = states.user();
  const toast = useAppToast();

  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [exporting, setExporting] = useState(false);

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

  const handleExport = async () => {
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
    <VStack className="gap-y-6 pb-6">
      {/* Date range pill tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <HStack className="gap-x-2 px-4">
          {dateRangeOptions.map((option) => (
            <FormButton
              key={option}
              size="sm"
              variant={option === dateRange ? "solid" : "outline"}
              text={option}
              onPress={() => setDateRange(option)}
            />
          ))}
        </HStack>
      </ScrollView>

      <VStack className="px-4 gap-y-4">
        {/* Total Group Spendings */}
        <Card className="rounded-xl bg-secondary-100">
          <SpendingHero
            items={totalSpendingsByCurrency}
            primaryCurrency={defaultCurrency}
          />
        </Card>

        {/* Net Balance */}
        <Card className="rounded-xl bg-secondary-100">
          <VStack className="gap-y-4">
            <NetBalanceHero
              items={netBalance}
              primaryCurrency={defaultCurrency}
            />
            <Divider />
            <HStack className="items-stretch">
              <VStack className="flex-1 gap-y-2">
                <HStack className="items-center gap-x-2">
                  <SettlementAvatar isPayer={true} />
                  <Text className="text-secondary-950">To Collect</Text>
                </HStack>
                <CurrencyAmountDisplay
                  isLoading={false}
                  items={toCollect}
                  label="To Collect"
                  type="receive"
                  primaryCurrency={defaultCurrency}
                />
              </VStack>
              <Divider orientation="vertical" className="mx-4" />
              <VStack className="flex-1 gap-y-2">
                <HStack className="items-center gap-x-2">
                  <SettlementAvatar isPayer={false} />
                  <Text className="text-secondary-950">To Pay</Text>
                </HStack>
                <CurrencyAmountDisplay
                  isLoading={false}
                  items={toPay}
                  label="To Pay"
                  type="pay"
                  primaryCurrency={defaultCurrency}
                />
              </VStack>
            </HStack>
          </VStack>
        </Card>

        {/* Export */}
        <VStack className="gap-y-3">
          <VStack className="gap-y-1">
            <Text bold className="text-secondary-950 uppercase text-sm">
              Export Settlements
            </Text>
            <Text className="text-secondary-950">
              The CSV includes all settlements you're involved in for this group
              within the selected date range — settlement ID, date, payer,
              member, amount, currency, and status.
            </Text>
          </VStack>
          <FormButton
            text="Export CSV"
            loading={exporting}
            onPress={handleExport}
          />
        </VStack>
      </VStack>
    </VStack>
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
