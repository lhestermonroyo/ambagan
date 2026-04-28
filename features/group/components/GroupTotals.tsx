// This component will show the total amount of expenses, total amount paid, and total amount owed for a group.

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { GroupDetails } from "@/types/groups";

export default function GroupTotals({
  details
}: {
  details: GroupDetails | null;
}) {
  if (!details) {
    return null;
  }

  return (
    <VStack className="gap-y-2">
      <HStack className="gap-x-2 px-4">
        <Card className="flex-1 rounded-xl border border-secondary-400 bg-secondary-50">
          <VStack className="gap-y-1">
            <Text className="text-sm text-secondary-950">Total Expenses</Text>
            <Text className="text-2xl" bold>
              $1,234.56
            </Text>
          </VStack>
        </Card>
        <Card className="flex-1 rounded-xl border border-secondary-400 bg-secondary-50">
          <VStack className="gap-y-1">
            <Text className="text-sm text-secondary-950">Total Paid</Text>
            <Text className="text-2xl" bold>
              $1,234.56
            </Text>
          </VStack>
        </Card>
      </HStack>
      <HStack className="gap-x-2 px-4">
        <Card className="flex-1 rounded-xl border border-secondary-400 bg-secondary-50">
          <VStack className="gap-y-1">
            <Text className="text-sm text-secondary-950">Total Expenses</Text>
            <Text className="text-2xl" bold>
              $1,234.56
            </Text>
          </VStack>
        </Card>
        <Card className="flex-1 rounded-xl border border-secondary-400 bg-secondary-50">
          <VStack className="gap-y-1">
            <Text className="text-sm text-secondary-950">Members</Text>
            <Text className="text-2xl" bold>
              {details.members.length || 0}
            </Text>
          </VStack>
        </Card>
      </HStack>
    </VStack>
  );
}
