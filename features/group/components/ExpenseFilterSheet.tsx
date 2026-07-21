import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import {
  Radio,
  RadioGroup,
  RadioIcon,
  RadioIndicator
} from "@/components/ui/radio";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { CircleIcon } from "lucide-react-native";

export const expenseFilterOptions = ["One-time", "Recurring"] as const;
export type ExpenseFilter = (typeof expenseFilterOptions)[number];

export default function ExpenseFilterSheet({
  isOpen,
  onClose,
  filter,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  filter: ExpenseFilter;
  onSelect: (f: ExpenseFilter) => void;
}) {
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4">
          <Text bold className="text-xl">
            Show
          </Text>
          <RadioGroup
            value={filter}
            onChange={(value) => {
              onSelect(value as ExpenseFilter);
              onClose();
            }}
          >
            <FlatList
              data={expenseFilterOptions}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              renderItem={({ item: option }) => (
                <Radio
                  value={option}
                  size="lg"
                  className="justify-between py-4"
                >
                  <Text className="text-lg">{option}</Text>
                  <RadioIndicator>
                    <RadioIcon as={CircleIcon} />
                  </RadioIndicator>
                </Radio>
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-0">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
            />
          </RadioGroup>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
