import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { TrendBucket } from "@/features/analytics/hooks/useAnalytics";

const BAR_MAX_HEIGHT = 72;

/**
 * Spend over time. Deliberately dumb: bucket width, labelling and which labels
 * to thin are all decided in useAnalytics, because they depend on the selected
 * range rather than on anything this component can see. It just draws what it's
 * handed, so the chart never has to be touched when the bucketing rules change.
 *
 * Empty buckets render as a grey stub rather than being dropped — a week with no
 * spending is a fact about the period, and closing the gap would silently
 * redraw the time axis.
 */
export default function AnalyticsTrendCard({
  trend
}: {
  trend: TrendBucket[];
}) {
  const max = Math.max(...trend.map((t) => t.amount), 1);

  return (
    <VStack className="gap-y-2">
      <Text bold className="text-2xl">
        Trend
      </Text>
      <Card className="rounded-2xl bg-secondary-100">
        <HStack
          className="items-end gap-x-1"
          style={{ height: BAR_MAX_HEIGHT + 24 }}
        >
          {trend.map((bucket) => {
            const height =
              bucket.amount > 0
                ? Math.max((bucket.amount / max) * BAR_MAX_HEIGHT, 4)
                : 4;
            return (
              <VStack
                key={bucket.key}
                className="flex-1 items-center gap-y-1"
                style={{ justifyContent: "flex-end" }}
              >
                <Box
                  className={`w-full rounded-t-md ${
                    bucket.amount > 0 ? "bg-primary-400" : "bg-background-200"
                  }`}
                  style={{ height }}
                />
                <Text
                  className="text-secondary-950 text-xs"
                  numberOfLines={1}
                >
                  {bucket.showLabel ? bucket.label : ""}
                </Text>
              </VStack>
            );
          })}
        </HStack>
      </Card>
    </VStack>
  );
}
