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
import { PersonalExpenseStatus } from "@/types/books";
import { CircleIcon } from "lucide-react-native";

const statusOptions: {
  value: PersonalExpenseStatus;
  label: string;
  description: string;
}[] = [
  { value: "paid", label: "Paid", description: "Already settled." },
  {
    value: "pending",
    label: "Pending",
    description: "An upcoming or unpaid bill."
  }
];

/**
 * Picks a personal expense's paid/pending status — the same Actionsheet+radio
 * pattern the other book-form fields use (Category, Repeat), so the Status
 * SelectField opens a familiar sheet instead of a bespoke control.
 */
export default function PersonalExpenseStatusSheet({
  isOpen,
  onClose,
  status,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  status: PersonalExpenseStatus;
  onSelect: (s: PersonalExpenseStatus) => void;
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
            Status
          </Text>
          <RadioGroup
            value={status}
            onChange={(value) => {
              onSelect(value as PersonalExpenseStatus);
              onClose();
            }}
          >
            <FlatList
              data={statusOptions}
              keyExtractor={(item) => item.value}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Radio
                  value={item.value}
                  size="md"
                  className="justify-between py-4"
                >
                  <VStack className="flex-1">
                    <Text className="text-lg">{item.label}</Text>
                    <Text className="text-sm text-secondary-950">
                      {item.description}
                    </Text>
                  </VStack>
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
