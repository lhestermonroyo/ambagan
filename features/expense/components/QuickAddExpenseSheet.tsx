import AmountInput from "@/components/AmountInput";
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
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  const { details: currentUser, defaultCurrency } = states.user();
  const toast = useAppToast();
  const router = useRouter();

  const isGroupPro = selectedGroup?.admin?.plan === "pro";

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setDescription("");
      setSelectedGroup(group);
      setCurrency(group?.admin?.plan === "pro" ? defaultCurrency : "PHP");
      if (group) fetchMembers(group.id);
    } else {
      setMembers([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedGroup && isOpen) {
      setCurrency(isGroupPro ? defaultCurrency : "PHP");
      fetchMembers(selectedGroup.id);
    }
  }, [selectedGroup?.id]);

  const fetchMembers = async (groupId: string) => {
    try {
      const result = await services.member.getMembersByGroupId(groupId);
      if (result) setMembers(result);
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
    !!selectedGroup;

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

      const payers = [{ userId: currentUser.id, amount: parsedAmount }];
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
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[60]}>
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
                    Paid by you · Equal split · Dated today
                  </Text>
                </VStack>
              </HStack>
            </Pressable>

            {!group ? (
              <VStack className="flex-1 items-center justify-center px-8 gap-y-4 pb-8">
                <Icon as="group-add" className="text-primary-400" size="xl" />
                <VStack className="items-center gap-y-1">
                  <Text bold className="text-lg text-center">
                    No Group Yet
                  </Text>
                  <Text className="text-secondary-950 text-sm text-center">
                    You need a group to add expenses. Create one to get
                    started.
                  </Text>
                </VStack>
                <FormButton
                  text="Create Group"
                  onPress={() => {
                    onClose();
                    setTimeout(() => router.push("/groups/create"), 300);
                  }}
                />
              </VStack>
            ) : (
              <>
                <ScrollView className="flex-1 px-4" bounces={false}>
                  <VStack className="gap-y-6">
                    <FormControl size="md">
                      <FormControlLabel>
                        <FormControlLabelText>Amount</FormControlLabelText>
                      </FormControlLabel>
                      <HStack className="gap-x-2 items-end h-12">
                        {isGroupPro ? (
                          <CurrencySelection
                            currency={currency}
                            onCurrencyChange={setCurrency}
                          />
                        ) : (
                          <Box className="border border-secondary-500 bg-secondary-50 items-center justify-center h-full px-2 py-2 rounded-lg">
                            <Text className="font-semibold text-secondary-950">
                              PHP (₱)
                            </Text>
                          </Box>
                        )}
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

                    {memberCount > 0 && (
                      <Fragment>
                        {allowGroupChange ? (
                          <PressableListItem
                            className="p-4 border border-background-200 rounded-lg"
                            onPress={() => setGroupPickerOpen(true)}
                          >
                            <HStack className="justify-between items-center gap-x-2 flex-1">
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
    </>
  );
}
