import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { AnalyticsData } from "@/features/analytics/hooks/useAnalytics";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { BASE_CURRENCY } from "@/utils/fx";

/** Below this the two figures are effectively equal — rounding, not a position. */
const NOISE_FLOOR = 1;

/**
 * What the user fronted versus what they actually consumed, over the period.
 *
 * This is the one stat only a splitting app can show, and the screen used to
 * carry both halves of it as two unexplained rows ("Involved" / "You Paid")
 * with nothing saying why they differ. The gap is the point: fronting a group
 * dinner isn't spending, it's lending, and it nets out when the group settles.
 *
 * Group-only by construction — a personal expense has nobody to front for, so
 * this renders nothing under the Personal scope.
 */
export default function AnalyticsFrontingCard({
  data
}: {
  data: AnalyticsData;
}) {
  const difference = data.fronted - data.frontedShare;
  const approx = data.frontingApprox ? "≈ " : "";

  const summary =
    Math.abs(difference) < NOISE_FLOOR
      ? "You fronted about your own share this period."
      : difference > 0
        ? `You fronted ${approx}${formatAmount(difference, BASE_CURRENCY)} more than your share — money you're owed, not money you spent.`
        : `Others fronted ${approx}${formatAmount(Math.abs(difference), BASE_CURRENCY)} of your share — money you owe, not money you've spent.`;

  return (
    <VStack className="gap-y-2">
      <Text bold className="text-2xl">
        Fronting
      </Text>
      <Card className="rounded-2xl bg-secondary-100">
        <VStack className="gap-y-4">
          <VStack className="gap-y-2">
            <HStack className="items-center justify-between gap-x-3">
              <Text className="text-sm text-secondary-950 flex-1">
                You fronted
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit>
                {approx}
                {formatAmount(data.fronted, BASE_CURRENCY)}
              </Text>
            </HStack>
            <HStack className="items-center justify-between gap-x-3">
              <Text className="text-sm text-secondary-950 flex-1">
                Your share
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit>
                {approx}
                {formatAmount(data.frontedShare, BASE_CURRENCY)}
              </Text>
            </HStack>
            <Divider />
            <HStack className="items-center justify-between gap-x-3">
              <Text bold>Difference</Text>
              <Text bold className="text-lg" numberOfLines={1} adjustsFontSizeToFit>
                {difference > 0 ? "+" : difference < 0 ? "−" : ""}
                {approx}
                {formatAmount(Math.abs(difference), BASE_CURRENCY)}
              </Text>
            </HStack>
          </VStack>

          <Text className="text-sm text-secondary-950">{summary}</Text>
        </VStack>
      </Card>
    </VStack>
  );
}
