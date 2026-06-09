import AppAvatarGroup from "@/components/AppAvatarGroup";
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
import { Input, InputField, InputSlot } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  generatePaymentSplits,
  getAmountPerPerson,
  getPercentagePerPerson
} from "@/features/expense/utils/split.util";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Member } from "@/types/groups";
import { getSecondaryHex } from "@/utils/getColorHex";
import { ChevronLeft } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

type QuickAddExpenseSheetProps = {
  isOpen: boolean;
  groupId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function QuickAddExpenseSheet({
  isOpen,
  groupId,
  onClose,
  onSuccess
}: QuickAddExpenseSheetProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  const { details: currentUser, defaultCurrency } = states.user();
  const colorScheme = useColorScheme() ?? "light";
  const toast = useAppToast();

  useEffect(() => {
    if (isOpen && groupId) {
      fetchMembers();
    } else {
      setAmount("");
      setDescription("");
      setMembers([]);
    }
  }, [isOpen, groupId]);

  const fetchMembers = async () => {
    try {
      const result = await services.member.getMembersByGroupId(groupId);
      if (result) setMembers(result);
    } catch {
      // submit button stays disabled if fetch fails
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
    !!currentUser;

  const handleSubmit = async () => {
    if (!currentUser || !canSubmit) return;
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
          group_id: groupId,
          proof_of_payment: null,
          split_type: "equal",
          currency: defaultCurrency
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
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[55]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1 gap-y-4">
          <Pressable onPress={onClose}>
            <HStack className="p-4 items-center gap-x-2">
              <ChevronLeft
                color={getSecondaryHex("text-secondary-950", colorScheme)}
              />
              <VStack>
                <Text bold className="text-xl">
                  Quick Add
                </Text>
                <Text className="text-secondary-950 text-sm">
                  You paid · Split equally among all members
                </Text>
              </VStack>
            </HStack>
          </Pressable>

          <VStack className="px-4 gap-y-4">
            <Input size="lg" className="rounded-lg h-16">
              <InputSlot className="pl-3">
                <Text bold className="text-2xl">
                  ₱
                </Text>
              </InputSlot>
              <InputField
                keyboardType="numeric"
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                autoFocus
                className="text-2xl font-bold"
              />
            </Input>

            <Input size="lg" className="rounded-lg">
              <InputField
                placeholder="What's this for?"
                value={description}
                onChangeText={setDescription}
              />
            </Input>

            {memberCount > 0 && (
              <Box className="p-4 rounded-xl border border-secondary-200 dark:border-secondary-800 bg-secondary-100 dark:bg-secondary-900">
                <HStack className="justify-between items-center">
                  <VStack className="gap-y-1">
                    <AppAvatarGroup
                      items={memberAvatars}
                      size="sm"
                      maxDisplay={4}
                    />
                    <Text className="text-secondary-950 text-xs">
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </Text>
                  </VStack>
                  <VStack className="items-end">
                    <Text bold className="text-2xl text-primary-400">
                      ₱{perPerson > 0 ? perPerson.toFixed(2) : "0.00"}
                    </Text>
                    <Text className="text-secondary-950 text-xs">each</Text>
                  </VStack>
                </HStack>
              </Box>
            )}
          </VStack>
        </VStack>

        <Box className="p-4">
          <FormButton
            className="flex-1"
            text="Add Expense"
            loading={submitting}
            disabled={!canSubmit}
            onPress={handleSubmit}
          />
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
}
