import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ContainerSpend } from "@/features/analytics/hooks/useAnalytics";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { BASE_CURRENCY } from "@/utils/fx";

/**
 * Spend per container, groups and personal books in one ranked list — the
 * "which of my things is expensive" view that neither a group nor a book can
 * show on its own.
 *
 * Bars are proportional to the LARGEST row, not to the total: the question here
 * is how the containers compare to each other, and scaling to the total leaves
 * everything but the top row as an unreadable stub once there are more than a
 * handful.
 *
 * Each row says which kind of container it is, because a group and a book can
 * share a name (a "Japan 2026" group beside a "Japan 2026" book is exactly the
 * linked-book setup the app encourages) and the amounts mean different things.
 */
export default function AnalyticsContainersCard({
  containers
}: {
  containers: ContainerSpend[];
}) {
  const max = Math.max(...containers.map((c) => c.amount), 1);

  return (
    <VStack className="gap-y-2">
      <Text bold className="text-2xl">
        Where It Went
      </Text>
      <Card className="rounded-2xl bg-secondary-100 py-6">
        <VStack className="gap-y-6">
          {containers.map((container) => (
            <VStack
              key={`${container.source}:${container.id}`}
              className="gap-y-1"
            >
              <HStack className="justify-between items-end gap-x-3">
                <VStack className="flex-1">
                  <Text className="text-lg" numberOfLines={1}>
                    {container.name}
                  </Text>
                  <Text className="text-sm text-secondary-950">
                    {container.source === "personal" ? "Book" : "Group"}
                  </Text>
                </VStack>
                <Text bold className="text-lg" numberOfLines={1}>
                  {container.approx ? "≈ " : ""}
                  {formatAmount(container.amount, BASE_CURRENCY)}
                </Text>
              </HStack>
              <Box className="h-2 rounded-full bg-background-200 overflow-hidden">
                <Box
                  className="h-2 rounded-full bg-primary-400"
                  style={{
                    width: `${Math.max((container.amount / max) * 100, 4)}%`
                  }}
                />
              </Box>
            </VStack>
          ))}
        </VStack>
      </Card>
    </VStack>
  );
}
