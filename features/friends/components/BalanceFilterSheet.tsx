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

export const balanceFilters = ["all", "collect", "pay"] as const;
export type BalanceFilter = (typeof balanceFilters)[number];

const balanceFilterOptions: { value: BalanceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "collect", label: "To Collect" },
  { value: "pay", label: "To Pay" }
];

export const balanceFilterLabel = (value: BalanceFilter) =>
  balanceFilterOptions.find((o) => o.value === value)?.label ?? "All";

/** Select a balance direction using the same chooser as settlement filters. */
export default function BalanceFilterSheet({
  isOpen,
  onClose,
  filter,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  filter: BalanceFilter;
  onSelect: (s: BalanceFilter) => void;
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
              onSelect(value as BalanceFilter);
              onClose();
            }}
          >
            <FlatList
              data={balanceFilterOptions}
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
