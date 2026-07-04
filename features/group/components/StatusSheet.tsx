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

export const statusOptions = [
  "All",
  "Pending",
  "Requested",
  "Settled"
] as const;
export type SettlementStatus = (typeof statusOptions)[number];

export default function StatusSheet({
  isOpen,
  onClose,
  status,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  status: SettlementStatus;
  onSelect: (s: SettlementStatus) => void;
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
              onSelect(value as SettlementStatus);
              onClose();
            }}
          >
            <FlatList
              data={statusOptions}
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
