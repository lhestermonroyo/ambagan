import Icon from "@/components/Icon";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { Transaction } from "@/types/transactions";
import { useEffect, useState } from "react";

export default function TransactionSheet({
  transaction,
  onClose
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const user = states.user.getState();

  useEffect;

  const fetchTransactionSplits = async () => {};

  const handleClose = () => {
    onClose();
  };

  return (
    <Actionsheet isOpen={!!transaction} onClose={handleClose} snapPoints={[94]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4 p-4">
          <HStack className="items-center">
            <Button
              variant="link"
              className="rounded-full"
              onPress={handleClose}
            >
              <Icon as="arrow-back-ios" className="text-secondary-950" />
            </Button>
            <Text bold className="text-xl">
              Expense Details
            </Text>
          </HStack>
        </VStack>
        {/* <FlatList
          className="flex-1 w-full"
          ListHeaderComponent={() => (
            <VStack className="w-full gap-y-4 p-4">
              <Text className="text-lg">{transaction?.description}</Text>
              <VStack>
                <Text className="text-4xl" bold>
                  ₱{transaction?.amount.toFixed(2)}
                </Text>
                <Text className="text-secondary-950">
                  Paid by {transaction?.paid_by?.first_name}
                </Text>
              </VStack>
            </VStack>
          )}
          key={}
        /> */}
      </ActionsheetContent>
    </Actionsheet>
  );
}
