import CategoryGauge from "@/components/CategoryGauge";
import CurrencyCountButton from "@/components/CurrencyCountButton";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { AnalyticsData } from "@/features/analytics/hooks/useAnalytics";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { BASE_CURRENCY } from "@/utils/fx";

/**
 * The headline card: how much, on what, and at what rate.
 *
 * The gauge carries both the total and the category split, so one card answers
 * "how much" and "on what" without the two competing for space — the same
 * arrangement as the book and group Stats tabs, which is where users will have
 * met it first.
 *
 * Every figure here is converted into {@link BASE_CURRENCY}, because this screen
 * spans containers that each have their own currency and a cross-container total
 * has to land in something. The per-currency chip is therefore not optional
 * decoration: it's the only route to the exact, unconverted working behind an
 * approximate headline.
 */
export default function AnalyticsTotalCard({ data }: { data: AnalyticsData }) {
  return (
    <Card className="rounded-2xl bg-secondary-100">
      <VStack className="gap-y-4">
        <HStack className="items-center justify-between">
          <Text bold className="text-secondary-950 uppercase text-sm">
            Total Spent
          </Text>
          <HStack className="items-center gap-x-2">
            <Text className="text-sm text-secondary-950">{BASE_CURRENCY}</Text>
            <CurrencyCountButton
              items={data.byCurrency}
              title="Total Spent"
              subtitle="By currency"
              convertTo={BASE_CURRENCY}
              totalLabel="Total spent"
            />
          </HStack>
        </HStack>

        <CategoryGauge
          slices={data.categories}
          total={data.total}
          currency={BASE_CURRENCY}
          approx={data.totalApprox}
        />

        <Divider />

        <HStack className="items-stretch">
          <VStack className="flex-1 gap-y-1">
            <Text className="text-sm text-secondary-950 uppercase">
              Expenses
            </Text>
            <Text bold className="text-lg">
              {data.expenseCount}
            </Text>
          </VStack>
          <Divider orientation="vertical" className="mx-3" />
          <VStack className="flex-1 gap-y-1">
            <Text className="text-sm text-secondary-950 uppercase">Avg</Text>
            <Text bold className="text-lg" numberOfLines={1} adjustsFontSizeToFit>
              {data.totalApprox ? "≈ " : ""}
              {formatAmount(data.average, BASE_CURRENCY)}
            </Text>
          </VStack>
          <Divider orientation="vertical" className="mx-3" />
          <VStack className="flex-1 gap-y-1">
            <Text className="text-sm text-secondary-950 uppercase">Per day</Text>
            <Text bold className="text-lg" numberOfLines={1} adjustsFontSizeToFit>
              {data.totalApprox ? "≈ " : ""}
              {formatAmount(data.perDay, BASE_CURRENCY)}
            </Text>
          </VStack>
        </HStack>

        {/* Logged but unpaid personal bills. Kept out of the total above and
            given its own line — an unpaid bill isn't money out yet, the same
            rule the book Stats tab and budget card follow. */}
        {data.pendingTotal > 0 && (
          <>
            <Divider />
            <HStack className="items-center justify-between gap-x-4">
              <Text className="text-secondary-950">Pending</Text>
              <Text bold className="text-lg">
                {data.pendingApprox ? "≈ " : ""}
                {formatAmount(data.pendingTotal, BASE_CURRENCY)}
              </Text>
            </HStack>
          </>
        )}
      </VStack>
    </Card>
  );
}
