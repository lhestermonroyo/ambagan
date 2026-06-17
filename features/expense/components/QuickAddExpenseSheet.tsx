import AmountInput from "@/components/AmountInput";
import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import CurrencySelection from "@/components/CurrencySelection";
import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { GroupSelectionActionSheet } from "@/features/expense/components/GroupSelection";
import { PayerSelectionActionSheet } from "@/features/expense/components/PayerSelection";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  generatePaymentSplits,
  getAmountPerPerson,
  getPercentagePerPerson
} from "@/features/expense/utils/split.util";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Group, Member } from "@/types/groups";
import { useRouter } from "expo-router";
import { Fragment, useEffect, useMemo, useState } from "react";

type QuickAddExpenseSheetProps = {
  isOpen: boolean;
  group: Group | null;
  allowGroupChange?: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function QuickAddExpenseSheet({
  isOpen,
  group,
  allowGroupChange = false,
  onClose,
  onSuccess
}: QuickAddExpenseSheetProps) {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(group);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedPayer, setSelectedPayer] = useState<Member | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [payerPickerOpen, setPayerPickerOpen] = useState(false);

  const { details: currentUser, defaultCurrency } = states.user();
  const toast = useAppToast();
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setDescription("");
      setSelectedGroup(group);
      setSelectedPayer(null);
      setCurrency(defaultCurrency);
      if (group) fetchMembers(group.id);
    } else {
      setMembers([]);
      setSelectedPayer(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedGroup && isOpen) {
      setCurrency(defaultCurrency);
      fetchMembers(selectedGroup.id);
    }
  }, [selectedGroup?.id]);

  const fetchMembers = async (groupId: string) => {
    try {
      const result = await services.member.getMembersByGroupId(groupId);
      if (result) {
        setMembers(result);
        const self = result.find((m) => m.id === currentUser?.id);
        setSelectedPayer(self ?? result[0] ?? null);
      }
    } catch {
      // submit stays disabled if fetch fails
    }
  };

  const memberAvatars = useMemo(
    () =>
      members.map((m) => ({
        id: m.id,
        name: m.first_name,
        uri: m.avatar || undefined
      })),
    [members]
  );

  const parsedAmount = parseFloat(amount) || 0;
  const memberCount = members.length;
  const perPerson = memberCount > 0 ? parsedAmount / memberCount : 0;

  const canSubmit =
    parsedAmount > 0 &&
    description.trim().length > 0 &&
    !submitting &&
    memberCount >= 2 &&
    !!currentUser &&
    !!selectedGroup &&
    !!selectedPayer;

  const handleSubmit = async () => {
    if (!currentUser || !selectedGroup || !canSubmit) return;
    setSubmitting(true);

    try {
      const amounts = getAmountPerPerson(parsedAmount, memberCount);
      const percentages = getPercentagePerPerson(memberCount);

      const memberSplits = members.map((m, i) => ({
        userId: m.id,
        amount: amounts[i],
        percentage: percentages[i]
      }));

      const payers = [
        { userId: selectedPayer?.id ?? currentUser.id, amount: parsedAmount }
      ];
      const paymentSplits = generatePaymentSplits(payers, memberSplits);

      await services.expense.saveExpense(
        {
          amount: parsedAmount,
          description: description.trim(),
          group_id: selectedGroup.id,
          proof_of_payment: null,
          split_type: "equal",
          currency
        },
        payers,
        memberSplits,
        paymentSplits
      );

      toast({
        title: "Expense Added",
        description: "Split equally among all members.",
        type: "success"
      });
      onSuccess();
      onClose();
    } catch {
      toast({
        title: "Failed",
        description: "Could not add expense. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full flex-1">
            <Pressable onPress={onClose}>
              <HStack className="p-4 items-start gap-x-1">
                <Icon as="arrow-back-ios" className="text-secondary-950" />
                <VStack>
                  <Text bold className="text-xl">
                    Quick Add
                  </Text>
                  <Text className="text-secondary-950">
                    {selectedPayer && selectedPayer.id !== currentUser?.id
                      ? `Paid by ${selectedPayer.first_name} · Equal split · Dated today`
                      : "Paid by you · Equal split · Dated today"}
                  </Text>
                </VStack>
              </HStack>
            </Pressable>

            {!group ? (
              <VStack className="flex-1 p-4">
                <VStack className="items-center justify-center flex-1 gap-y-4">
                  <Icon
                    as="sentiment-dissatisfied"
                    size={64}
                    className="text-primary-400"
                  />
                  <Text className="text-center">
                    You are not part of any group yet. Please join or create a
                    group to be able to add an expense.
                  </Text>
                  <FormButton
                    text="Create Group"
                    iconEnd={
                      <Icon as="chevron-right" className="text-background-0" />
                    }
                    onPress={() => router.push("/groups/create")}
                  />
                </VStack>
              </VStack>
            ) : (
              <>
                <ScrollView className="flex-1 px-4">
                  <VStack className="gap-y-6">
                    <FormControl size="md">
                      <FormControlLabel>
                        <FormControlLabelText>Amount</FormControlLabelText>
                      </FormControlLabel>
                      <HStack className="gap-x-2 items-end h-12">
                        <CurrencySelection
                          currency={currency}
                          onCurrencyChange={setCurrency}
                        />
                        <VStack className="flex-1">
                          <AmountInput
                            className="h-full"
                            placeholder="0.00"
                            value={amount}
                            onChangeText={setAmount}
                          />
                        </VStack>
                      </HStack>
                    </FormControl>

                    <FormTextarea
                      label="Description"
                      placeholder="Enter description (e.g., Dinner at KFC Baguio)"
                      value={description}
                      onChangeText={setDescription}
                      autoCapitalize="none"
                      size="sm"
                    />

                    {selectedPayer && (
                      <FormControl size="md">
                        <FormControlLabel>
                          <FormControlLabelText>Payer</FormControlLabelText>
                        </FormControlLabel>
                        <PressableListItem
                          className="p-4 border border-background-200 rounded-lg"
                          onPress={() => setPayerPickerOpen(true)}
                        >
                          <HStack className="justify-between items-center gap-x-2 flex-1">
                            <HStack className="gap-x-3 items-center flex-1">
                              <AppAvatar
                                name={`${selectedPayer.first_name} ${selectedPayer.last_name ?? ""}`.trim()}
                                uri={selectedPayer.avatar ?? ""}
                              />
                              <VStack className="flex-1">
                                <HStack className="gap-x-1 items-center">
                                  <Text className="text-lg">
                                    {selectedPayer.first_name}{" "}
                                    {selectedPayer.last_name}{" "}
                                    {selectedPayer.id === currentUser?.id &&
                                      "(You)"}
                                  </Text>
                                </HStack>
                                <Text className="text-secondary-950">
                                  {selectedPayer.email}
                                </Text>
                              </VStack>
                            </HStack>
                            <Icon
                              as="unfold-more"
                              className="text-secondary-950"
                            />
                          </HStack>
                        </PressableListItem>
                      </FormControl>
                    )}

                    {memberCount > 0 && (
                      <Fragment>
                        {allowGroupChange ? (
                          <PressableListItem
                            className="p-4 border border-background-200 rounded-lg"
                            onPress={() => setGroupPickerOpen(true)}
                          >
                            <HStack className="justify-between items-center gap-x-2">
                              <HStack className="gap-x-2 items-center flex-1">
                                <VStack className="gap-y-2 flex-1">
                                  <Text className="text-secondary-950 font-medium">
                                    {selectedGroup?.name}
                                  </Text>
                                  <VStack className="items-start gap-y-1">
                                    <AppAvatarGroup
                                      items={memberAvatars}
                                      size="sm"
                                      maxDisplay={4}
                                    />
                                    <Text className="text-secondary-950 text-sm">
                                      {memberCount} member
                                      {memberCount !== 1 ? "s" : ""}
                                    </Text>
                                  </VStack>
                                </VStack>
                                <VStack className="items-end">
                                  <Text
                                    bold
                                    className="text-2xl text-primary-400"
                                  >
                                    {formatAmount(perPerson, currency)}
                                  </Text>
                                  <Text className="text-secondary-950 text-sm">
                                    each
                                  </Text>
                                </VStack>
                              </HStack>
                              <Icon
                                as="unfold-more"
                                className="text-secondary-950"
                              />
                            </HStack>
                          </PressableListItem>
                        ) : (
                          <Box className="p-4 border border-background-200 rounded-lg">
                            <HStack className="justify-between items-center gap-x-2 flex-1">
                              <HStack className="gap-x-2 items-center flex-1">
                                <VStack className="gap-y-2 flex-1">
                                  <Text className="font-medium text-lg">
                                    {selectedGroup?.name}
                                  </Text>
                                  <VStack className="items-start gap-y-1">
                                    <AppAvatarGroup
                                      items={memberAvatars}
                                      size="sm"
                                      maxDisplay={4}
                                    />
                                    <Text className="text-secondary-950 text-sm">
                                      {memberCount} member
                                      {memberCount !== 1 ? "s" : ""}
                                    </Text>
                                  </VStack>
                                </VStack>
                                <VStack className="items-end">
                                  <Text
                                    bold
                                    className="text-2xl text-primary-400"
                                  >
                                    {formatAmount(perPerson, currency)}
                                  </Text>
                                  <Text className="text-secondary-950 text-sm">
                                    each
                                  </Text>
                                </VStack>
                              </HStack>
                            </HStack>
                          </Box>
                        )}
                      </Fragment>
                    )}
                  </VStack>
                </ScrollView>

                <Box className="items-center justify-center p-4">
                  <HStack className="gap-x-2">
                    <FormButton
                      className="flex-1"
                      text="Add Expense"
                      loading={submitting}
                      disabled={!canSubmit}
                      onPress={handleSubmit}
                    />
                  </HStack>
                </Box>
              </>
            )}
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      {selectedGroup && (
        <GroupSelectionActionSheet
          isOpen={groupPickerOpen}
          onClose={() => setGroupPickerOpen(false)}
          currentGroup={selectedGroup}
          onChangeGroup={(g) => setSelectedGroup(g)}
        />
      )}
      <PayerSelectionActionSheet
        isOpen={payerPickerOpen}
        members={members}
        currentPayer={selectedPayer}
        onClose={() => setPayerPickerOpen(false)}
        onSave={(payer) => setSelectedPayer(payer)}
      />
    </>
  );
}
