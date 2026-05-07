import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { formatDate } from "@/utils/formatDate";
import { getPrimaryHex } from "@/utils/getColorHex";
import { FileImage } from "lucide-react-native";
import { useColorScheme } from "react-native";
import { ReactNode } from "react";

export default function ExpenseDetailsSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { details: expenseDetails } = states.expense.getState();
  const { details: userDetails } = states.user();
  const colorScheme = useColorScheme() ?? "light";

  if (!expenseDetails) return null;

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[50]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full h-full gap-y-4 p-4">
          <VStack className="gap-y-4 flex-1">
            <Text bold className="text-xl">
              Expense Info
            </Text>
            <Box className="bg-secondary-100 rounded-xl overflow-hidden">
              <DetailRow
                label="Expense Date"
                value={<Text>{formatDate(expenseDetails.created_at)}</Text>}
              />
              <DetailRow
                label="Created By"
                value={
                  <HStack className="gap-x-2 items-center">
                    <AppAvatar
                      name={`${expenseDetails.creator.first_name} ${expenseDetails.creator.last_name}`}
                      uri={expenseDetails.creator.avatar!}
                      size="sm"
                    />
                    <Text>
                      {expenseDetails.creator.first_name}{" "}
                      {expenseDetails.creator.last_name}
                      {expenseDetails.creator.id === userDetails?.id &&
                        " (You)"}
                    </Text>
                  </HStack>
                }
              />
              <DetailRow
                label="Split Type"
                value={
                  <Text className="capitalize">
                    {expenseDetails.split_type}
                  </Text>
                }
              />
              <DetailRow
                label="Proof of Payment"
                value={
                  expenseDetails.proof_of_payment ? (
                    <FormButton
                      size="md"
                      variant="outline"
                      text="View Image"
                      icon={
                        <FileImage
                          size={18}
                          color={getPrimaryHex("text-primary-500", colorScheme)}
                        />
                      }
                      onPress={() => {}}
                    />
                  ) : (
                    <Text className="text-secondary-950">N/A</Text>
                  )
                }
              />
            </Box>
          </VStack>
          <FormButton variant="outline" text="Close" onPress={onClose} />
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <HStack className="items-center justify-between p-4">
      <Text className="text-secondary-950">{label}</Text>
      {value}
    </HStack>
  );
}
