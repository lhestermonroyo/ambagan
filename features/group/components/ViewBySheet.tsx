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

export const viewOptions = ["By Date", "By Expense", "By Person"] as const;
export type ViewOption = (typeof viewOptions)[number];

export default function ViewBySheet({
  isOpen,
  onClose,
  viewBy,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  viewBy: ViewOption;
  onSelect: (v: ViewOption) => void;
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
            View By
          </Text>
          <RadioGroup
            value={viewBy}
            onChange={(value) => {
              onSelect(value as ViewOption);
              onClose();
            }}
          >
            <FlatList
              data={viewOptions}
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
