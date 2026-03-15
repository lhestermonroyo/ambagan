import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField, InputSlot } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import {
  Toast,
  ToastDescription,
  ToastTitle,
  useToast
} from "@/components/ui/toast";
import { VStack } from "@/components/ui/vstack";
import { Member } from "@/types/groups";
import { splitTypes } from "@/utils/constants";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  getAmountPerPerson,
  getPercentagePerPerson
} from "../utils/split.util";

type Splits = {
  [userId: string]: {
    amount: string;
    percentage: string;
    isIncluded: boolean;
  };
};

type SplitExpenseStepProps = {
  values: {
    amount: string;
    description: string;
  };
  groupId: string;
  members: Member[];
  splits: Splits;
  setSplits: (splits: Splits) => void;
};

export default function SplitSelection({
  values,
  members,
  splits,
  setSplits
}: SplitExpenseStepProps) {
  const [tab, setTab] = useState<string>(splitTypes[0].value);

  const totalAmount = parseFloat(values.amount) || 0;

  useEffect(() => {
    const initialSplits: {
      [userId: string]: {
        amount: string;
        percentage: string;
        isIncluded: boolean;
      };
    } = {};

    members.forEach((member) => {
      if (!splits[member.id]) {
        initialSplits[member.id] = {
          amount:
            tab === "equal"
              ? (totalAmount / members.length).toFixed(2)
              : "0.00",
          percentage:
            tab === "equal" ? (100 / members.length).toFixed(2) : "0.00",
          isIncluded: tab === "equal"
        };
      } else {
        initialSplits[member.id] = splits[member.id];
      }
    });

    if (tab === "equal") {
      // For equal split, recalculate amounts
      const includedMembers = Object.entries(initialSplits).filter(
        ([_, split]) => split.isIncluded
      );
      const amountPerPerson = getAmountPerPerson(
        totalAmount,
        includedMembers.length
      );
      const percentages = getPercentagePerPerson(includedMembers.length);
      let idx = 0;
      Object.keys(initialSplits).forEach((userId) => {
        if (initialSplits[userId].isIncluded) {
          initialSplits[userId].amount =
            amountPerPerson[idx]?.toFixed(2) || "0";
          initialSplits[userId].percentage =
            percentages[idx]?.toFixed(2) || "0";
          idx++;
        } else {
          initialSplits[userId].amount = "0.00";
          initialSplits[userId].percentage = "0";
        }
      });
    }

    setSplits(initialSplits);
  }, [tab, totalAmount, members.length]);

  const toggleMemberInclusion = (userId: string) => {
    const newSplits = { ...splits };
    newSplits[userId].isIncluded = !newSplits[userId].isIncluded;

    if (tab === "equal") {
      const includedMembers = Object.entries(newSplits).filter(
        ([_, split]) => split.isIncluded
      );
      const amountPerPerson = getAmountPerPerson(
        totalAmount,
        includedMembers.length
      );
      const percentages = getPercentagePerPerson(includedMembers.length);
      let idx = 0;
      Object.keys(newSplits).forEach((userId) => {
        if (newSplits[userId].isIncluded) {
          newSplits[userId].amount = amountPerPerson[idx]?.toFixed(2) || "0";
          newSplits[userId].percentage = percentages[idx]?.toFixed(2) || "0";
          idx++;
        } else {
          newSplits[userId].amount = "0.00";
          newSplits[userId].percentage = "0";
        }
      });
    } else if (!newSplits[userId].isIncluded) {
      newSplits[userId].amount = "0.00";
      newSplits[userId].percentage = "0";
    }

    setSplits(newSplits);
  };

  const updateSplitAmount = (userId: string, amount: string) => {
    const newSplits = { ...splits };
    newSplits[userId].amount = amount;

    if (tab === "custom") {
      const percentage =
        totalAmount > 0
          ? (((parseFloat(amount) || 0) / totalAmount) * 100).toFixed(2)
          : "0.00";
      newSplits[userId].percentage = percentage;
      newSplits[userId].amount = amount;
    }

    setSplits(newSplits);
  };

  const updateSplitPercentage = (userId: string, percentage: string) => {
    const newSplits = { ...splits };
    newSplits[userId].percentage = percentage;

    if (tab === "percentage") {
      const amount = (
        (totalAmount * (parseFloat(percentage) || 0)) /
        100
      ).toFixed(2);
      newSplits[userId].percentage = percentage;
      newSplits[userId].amount = amount;
    }

    setSplits(newSplits);
  };

  const totalSplitAmount = Object.values(splits).reduce(
    (sum, split) => sum + (parseFloat(split.amount) || 0),
    0
  );
  const totalPercentage = Object.values(splits).reduce(
    (sum, split) => sum + (parseFloat(split.percentage) || 0),
    0
  );

  const expenseValues = useMemo(() => {
    const includedCount = splits
      ? Object.values(splits).filter((split) => split.isIncluded).length
      : 0;

    return {
      amount: totalAmount,
      equalSplits: getAmountPerPerson(totalAmount, includedCount),
      includedCount
    };
  }, [splits]);
  const { amount, equalSplits, includedCount } = expenseValues;

  return (
    <Fragment>
      <VStack className="gap-y-4 pb-4">
        <VStack className="px-4 items-center">
          <Text bold className="text-2xl">
            ₱{amount.toFixed(2)}
          </Text>
          <Text className="text-secondary-950 text-sm">Amount to Split</Text>
        </VStack>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <HStack className="gap-x-2 px-4">
            {splitTypes.map((type) => (
              <FormButton
                size="md"
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
      <FlatList
        className="flex-1 h-full"
        data={members}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => (
          <Box className="mx-4">
            <Divider className="border-secondary-100" />
          </Box>
        )}
        renderItem={({ item: member }) => {
          const canFillRemainingPercentage =
            tab === "percentage" && totalPercentage < 100;
          const canFillRemainingCustom =
            tab === "custom" && totalSplitAmount < totalAmount;

          return (
            <MemberItem
              member={member}
              splitType={tab}
              split={
                splits[member.id] || {
                  amount: "0.00",
                  percentage: "0.00",
                  isIncluded: false
                }
              }
              canFillRemainingPercentage={canFillRemainingPercentage}
              canFillRemainingCustom={canFillRemainingCustom}
              totalAmount={totalAmount}
              totalPercentage={totalPercentage}
              totalSplitAmount={totalSplitAmount}
              onToggle={() => toggleMemberInclusion(member.id)}
              onAmountChange={(amount) => updateSplitAmount(member.id, amount)}
              onPercentageChange={(percentage) =>
                updateSplitPercentage(member.id, percentage)
              }
            />
          );
        }}
      />

      <Box className="p-4 bg-background-50 rounded-lg">
        {tab === "equal" && (
          <VStack className="items-center">
            <Text className="text-lg">
              ₱{equalSplits[0]?.toFixed(2) || "0"} per person
            </Text>
            <Text className="text-secondary-950 text-sm">
              ({includedCount} {includedCount === 1 ? "person" : "people"})
            </Text>
          </VStack>
        )}

        {tab === "percentage" && (
          <VStack className="items-center">
            <Text className="text-lg">
              {totalPercentage.toFixed(0)}% of 100%
            </Text>
            <Text className="text-secondary-950 text-sm">
              {Math.max(0, 100 - totalPercentage).toFixed(0)}% left to allocate
              (₱
              {Math.max(
                0,
                totalAmount - totalAmount * (totalPercentage / 100)
              ).toFixed(2)}
              )
            </Text>
          </VStack>
        )}

        {tab === "custom" && (
          <VStack className="items-center">
            <Text className="text-lg">
              ₱{totalSplitAmount.toFixed(2)} of ₱{totalAmount.toFixed(2)}
            </Text>
            <Text className="text-secondary-950 text-sm">
              ₱{Math.max(0, totalAmount - totalSplitAmount).toFixed(2)} left to
              allocate
            </Text>
          </VStack>
        )}

        {includedCount < 2 && (
          <Text className="text-red-500 text-sm mt-2">
            Please include at least 2 members or more to split the expense.
          </Text>
        )}
      </Box>
    </Fragment>
  );
}

function MemberItem({
  member,
  splitType,
  split,
  canFillRemainingPercentage = false,
  canFillRemainingCustom = false,
  totalAmount,
  totalPercentage,
  totalSplitAmount,
  onToggle,
  onAmountChange,
  onPercentageChange
}: {
  member: Member;
  splitType: string;
  split: { amount: string; percentage: string; isIncluded: boolean };
  canFillRemainingPercentage: boolean;
  canFillRemainingCustom: boolean;
  totalAmount: number;
  totalPercentage: number;
  totalSplitAmount: number;
  onToggle: () => void;
  onAmountChange: (amount: string) => void;
  onPercentageChange: (percentage: string) => void;
}) {
  const toast = useToast();

  const handleToast = useCallback(
    (title: string, description: string, type: any) => {
      toast.show({
        placement: "top",
        duration: 5000,
        render: ({ id }) => {
          const uniqueToastId = "toast-" + id;

          return (
            <Toast nativeID={uniqueToastId} action={type} variant="outline">
              <ToastTitle>{title}</ToastTitle>
              <ToastDescription>{description}</ToastDescription>
            </Toast>
          );
        }
      });
    },
    [toast]
  );

  // Clamp input so total does not exceed 100% or totalAmount
  const handleFillRemainingPercentage = () => {
    const remaining = Math.max(0, 100 - totalPercentage);
    const newValue = (parseFloat(split.percentage) || 0) + remaining;
    const clampedValue = Math.min(
      newValue,
      100 - (totalPercentage - (parseFloat(split.percentage) || 0))
    );
    onPercentageChange(clampedValue.toFixed(0));
  };

  const handleFillRemainingCustom = () => {
    const remaining = Math.max(0, totalAmount - totalSplitAmount);
    const newValue = (parseFloat(split.amount) || 0) + remaining;
    const clampedValue = Math.min(
      newValue,
      totalAmount - (totalSplitAmount - (parseFloat(split.amount) || 0))
    );
    onAmountChange(clampedValue.toFixed(2));
  };

  const handleManualPercentageChange = (input: string) => {
    let value = parseFloat(input) || 0;
    const maxAllowed =
      100 - (totalPercentage - (parseFloat(split.percentage) || 0));
    if (value > maxAllowed) {
      value = maxAllowed;
      handleToast(
        "Input Error",
        `Max allowed is ${maxAllowed.toFixed(0)}%`,
        "error"
      );
    }
    onPercentageChange(value.toString());
  };

  // Clamp manual input for amount
  const handleManualAmountChange = (input: string) => {
    let value = parseFloat(input) || 0;
    const maxAllowed =
      totalAmount - (totalSplitAmount - (parseFloat(split.amount) || 0));
    if (value > maxAllowed) {
      value = maxAllowed;
      handleToast(
        "Input Error",
        `Max allowed is ₱${maxAllowed.toFixed(2)}`,
        "error"
      );
      return;
    }
    onAmountChange(value.toString());
  };

  return (
    <Box className="p-4">
      <HStack className="gap-x-4 items-center">
        <Pressable onPress={onToggle}>
          <Box
            className={`w-6 h-6 rounded border-2 ${split.isIncluded ? "bg-primary-500 border-primary-500" : "border-background-300"} items-center justify-center`}
          >
            {split.isIncluded && (
              <Icon as="check" size={16} className="text-background-0" />
            )}
          </Box>
        </Pressable>

        <HStack className="flex-1 items-center gap-x-2">
          <AppAvatar name={member.first_name} uri={member.avatar || ""} />
          <Text className="text-lg">
            {member.first_name} {member.last_name}
          </Text>
        </HStack>

        {split.isIncluded && (
          <VStack className="items-end">
            {splitType === "equal" && (
              <VStack className="items-end gap-y-2">
                <Text className="text-lg">₱{split.amount}</Text>
                <Text className="text-secondary-950 text-sm">
                  {split.percentage}%
                </Text>
              </VStack>
            )}

            {splitType === "percentage" && (
              <VStack className="items-end gap-y-2">
                <HStack className="items-end justify-end gap-x-2">
                  <Input variant="underlined" className="w-16 px-1" size="lg">
                    <InputField
                      autoCapitalize="none"
                      keyboardType="numeric"
                      type="text"
                      placeholder="0"
                      value={split.percentage}
                      onChangeText={handleManualPercentageChange}
                    />
                    <InputSlot>
                      <Text className="text-lg">%</Text>
                    </InputSlot>
                  </Input>
                </HStack>
                {canFillRemainingPercentage && (
                  <Pressable onPress={handleFillRemainingPercentage}>
                    <Text className="text-primary-500">Fill Remaining</Text>
                  </Pressable>
                )}
                <Text className="text-secondary-950 text-sm">
                  ₱{split.amount || 0}
                </Text>
              </VStack>
            )}

            {splitType === "custom" && (
              <VStack className="items-end gap-y-2">
                <HStack className="items-end justify-end gap-x-1">
                  <Input
                    variant="underlined"
                    className="px-1 text-right w-[100px]"
                    style={{ width: 100 }}
                    size="lg"
                  >
                    <InputSlot className="mr-2">
                      <Text className="text-lg">₱</Text>
                    </InputSlot>
                    <InputField
                      style={{
                        textAlign: "right"
                      }}
                      autoCapitalize="none"
                      keyboardType="numeric"
                      type="text"
                      placeholder="0.00"
                      value={split.amount}
                      onChangeText={handleManualAmountChange}
                    />
                  </Input>
                </HStack>
                {canFillRemainingCustom && (
                  <Pressable onPress={handleFillRemainingCustom}>
                    <Text className="text-primary-500">Fill Remaining</Text>
                  </Pressable>
                )}
                <Text className="text-secondary-950 text-sm">
                  {split.percentage || 0}%
                </Text>
              </VStack>
            )}
          </VStack>
        )}
      </HStack>
    </Box>
  );
}
