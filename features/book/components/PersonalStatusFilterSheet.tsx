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

export const personalStatusFilters = ["all", "pending", "paid"] as const;
export type PersonalStatusFilter = (typeof personalStatusFilters)[number];

const statusFilterOptions: { value: PersonalStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" }
];

export const personalStatusFilterLabel = (value: PersonalStatusFilter) =>
  statusFilterOptions.find((o) => o.value === value)?.label ?? "All";

/**
 * Filters the book's expense list by paid/pending status (or All). Same
 * Actionsheet+radio pattern as the settlement StatusSheet / category sheet, so
 * the Expenses-tab filter pill opens a familiar chooser.
 */
export default function PersonalStatusFilterSheet({
  isOpen,
  onClose,
  status,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  status: PersonalStatusFilter;
  onSelect: (s: PersonalStatusFilter) => void;
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
            value={status}
            onChange={(value) => {
              onSelect(value as PersonalStatusFilter);
              onClose();
            }}
          >
            <FlatList
              data={statusFilterOptions}
              keyExtractor={(item) => item.value}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Radio
                  value={item.value}
                  size="md"
                  className="justify-between py-4"
                >
                  <Text className="text-lg">{item.label}</Text>
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
