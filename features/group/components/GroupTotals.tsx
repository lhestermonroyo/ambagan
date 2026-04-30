// This component will show the total amount of expenses, total amount paid, and total amount owed for a group.

import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";

export default function GroupTotals() {
  const { details } = states.group.getState();
  return (
    <VStack className="gap-y-4">
      <HStack className="gap-x-2 px-4">
        <Card className="flex-1 rounded-xl bg-secondary-100">
          <VStack className="gap-y-1">
            <Text className="text-sm text-secondary-950">Total Spending</Text>
            <Text className="text-2xl" bold>
              $1,234.56
            </Text>
          </VStack>
        </Card>
        <Card className="flex-1 rounded-xl bg-secondary-100">
          <VStack className="gap-y-1">
            <Text className="text-sm text-secondary-950">
              Total Paid By Members
            </Text>
            <Text className="text-2xl" bold>
              $1,234.56
            </Text>
          </VStack>
        </Card>
      </HStack>
      <HStack className="gap-x-2 px-4">
        <Card className="flex-1 rounded-xl bg-secondary-100">
          <VStack className="gap-y-1">
            <Text className="text-sm text-secondary-950">Total Unpaid</Text>
            <Text className="text-2xl" bold>
              $1,234.56
            </Text>
          </VStack>
        </Card>
      </HStack>

      <Box className="mx-4">
        <Divider className="border-secondary-100" />
      </Box>

      <VStack className="gap-y-2 mx-4">
        <Text bold className="text-2xl flex-1">
          Individual Totals
        </Text>
      </VStack>
    </VStack>
  );
}
