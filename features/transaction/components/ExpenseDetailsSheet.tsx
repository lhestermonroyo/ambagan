import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import services from "@/services";
import states from "@/states";
import { MemberSplit, Transaction } from "@/types/transactions";
import { useFocusEffect } from "expo-router";
import { useMemo, useState } from "react";

const expenseDetailsTabTypes = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Settled", value: "settled" }
];

export default function ExpenseDetailsSheet({
  transaction,
  onClose
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<string>(expenseDetailsTabTypes[0].value);
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [splits, setSplits] = useState<MemberSplit[]>([]);

  const user = states.user.getState();

  useFocusEffect(
    useMemo(
      () => () => {
        fetchTransactionSplits(transaction?.id as string);
      },
      [transaction?.id]
    )
  );

  const fetchTransactionSplits = async (id: string) => {
    try {
      const response = await services.transaction.getSplitsByTransaction(id);

      if (response) {
        setSplits(response);
      }
    } catch (error) {
      console.log("Error fetching transaction splits:", error);
    }
  };

  const handleClose = () => {
    onClose();
  };

  console.log(splits);

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
        <FlatList
          className="flex-1 w-full"
          ListHeaderComponent={() => (
            <VStack className="gap-y-6">
              <VStack className="w-full gap-y-4 p-4">
                <Text className="text-lg">{transaction?.description}</Text>
                <VStack>
                  <Text className="text-4xl" bold>
                    ₱{transaction?.amount.toFixed(2)}
                  </Text>
                  <HStack className="gap-x-1">
                    <Text className="text-secondary-950">Paid by</Text>
                    <AppAvatar
                      name={transaction?.paid_by.first_name || ""}
                      uri={transaction?.paid_by.avatar || ""}
                      size="xs"
                    />
                    <Text className="text-secondary-950">
                      {transaction?.paid_by.first_name}{" "}
                      {transaction?.paid_by.last_name}
                    </Text>
                  </HStack>
                </VStack>
              </VStack>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <HStack className="gap-x-2 px-4">
                  {expenseDetailsTabTypes.map((type) => (
                    <FormButton
                      key={type.value}
                      variant={type.value === tab ? "solid" : "outline"}
                      className="flex-1 h-10"
                      text={type.label}
                      onPress={() => setTab(type.value)}
                    />
                  ))}
                </HStack>
              </ScrollView>
            </VStack>
          )}
          keyExtractor={(item) => item.member.id}
          data={splits}
          renderItem={({ item }) => (
            <SplitItem
              key={item.member.id}
              transaction={transaction}
              split={item}
            />
          )}
          ItemSeparatorComponent={() => (
            <Box className="mx-4">
              <Divider className="border-secondary-100" />
            </Box>
          )}
        />
      </ActionsheetContent>
    </Actionsheet>
  );
}

function SplitItem({
  split
}: {
  transaction: Transaction | null;
  split: MemberSplit;
}) {
  return (
    <HStack className="p-4 items-center">
      <VStack className="w-full justify-between flex-1">
        <Text className="text-lg">
          {split.member.first_name} {split.member.last_name}
        </Text>
        <Text className="text-secondary-950">
          owes ₱{split.amount.toFixed(2)}
        </Text>
      </VStack>
      <FormButton text={split.status === "pending" ? "Settle Up" : "Settled"} />
    </HStack>
  );
}
