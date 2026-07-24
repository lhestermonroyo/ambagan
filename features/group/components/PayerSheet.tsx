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

export const payerOptions = ["All", "Me"] as const;
export type PayerOption = (typeof payerOptions)[number];

export const payerLabels: Record<PayerOption, string> = {
  All: "Everyone",
  Me: "Paid by me"
};

export default function PayerSheet({
  isOpen,
  onClose,
  payer,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  payer: PayerOption;
  onSelect: (v: PayerOption) => void;
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
            Payer
          </Text>
          <RadioGroup
            value={payer}
            onChange={(value) => {
              onSelect(value as PayerOption);
              onClose();
            }}
          >
            <FlatList
              data={payerOptions}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              renderItem={({ item: option }) => (
                <Radio
                  value={option}
                  size="md"
                  className="justify-between py-4"
                >
                  <Text className="text-lg">{payerLabels[option]}</Text>
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
