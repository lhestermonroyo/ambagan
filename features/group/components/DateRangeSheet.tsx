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

export const dateRangeOptions = [
  "All",
  "1D",
  "1W",
  "2W",
  "1M",
  "3M",
  "6M",
  "1Y"
] as const;
export type DateRangeOption = (typeof dateRangeOptions)[number];

export const dateRangeLabels: Record<DateRangeOption, string> = {
  All: "All Time",
  "1D": "Last 24 Hours",
  "1W": "Last 7 Days",
  "2W": "Last 2 Weeks",
  "1M": "Last Month",
  "3M": "Last 3 Months",
  "6M": "Last 6 Months",
  "1Y": "Last Year"
};

export const getDateRangeCutoff = (range: DateRangeOption): Date | null => {
  if (range === "All") return null;
  const days: Record<Exclude<DateRangeOption, "All">, number> = {
    "1D": 1,
    "1W": 7,
    "2W": 14,
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365
  };
  return new Date(Date.now() - days[range] * 24 * 60 * 60 * 1000);
};

export default function DateRangeSheet({
  isOpen,
  onClose,
  dateRange,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  dateRange: DateRangeOption;
  onSelect: (v: DateRangeOption) => void;
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
            Date Range
          </Text>
          <RadioGroup
            value={dateRange}
            onChange={(value) => {
              onSelect(value as DateRangeOption);
              onClose();
            }}
          >
            <FlatList
              data={dateRangeOptions}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              renderItem={({ item: option }) => (
                <Radio
                  value={option}
                  size="lg"
                  className="justify-between py-4"
                >
                  <Text className="text-lg">{dateRangeLabels[option]}</Text>
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
