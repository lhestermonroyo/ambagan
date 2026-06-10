import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import StepperProgress from "@/components/StepperProgress";
import { Box } from "@/components/ui/box";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField, InputSlot } from "@/components/ui/input";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { Member } from "@/types/groups";
import { EmptyType } from "@/types/general";
import { getCurrencySign } from "@/utils/currency";
import { splitTypes } from "@/utils/constants";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Fragment, useEffect, useMemo, useState } from "react";
import ListDivider from "@/components/ListDivider";
import { formatAmount } from "../utils/formatAmount";
import {
  getAmountPerPerson,
  getPercentagePerPerson
} from "../utils/split.util";

type Splits = {
  [userId: string]: {
    amount: string;
    percentage: string;
  };
};

type SplitExpenseStepProps = {
  step: number;
  amount: string;
  currency: string;
  groupId: string;
  members: Member[];
  splits: Splits;
  onSetSplits: (
    splits: Splits,
    tab: (typeof splitTypes)[number]["value"]
  ) => void;
};

export default function SplitSelection({
  step,
  amount,
  currency,
  members,
  splits,
  onSetSplits
}: SplitExpenseStepProps) {
  const [tab, setTab] = useState<(typeof splitTypes)[number]["value"]>(
    splitTypes[0].value
  );

  const totalAmount = parseFloat(amount) || 0;

  useEffect(() => {
    const initialSplits: {
      [userId: string]: {
        amount: string;
        percentage: string;
      };
    } = {};

    members.forEach((member) => {
      if (!initialSplits[member.id]) {
        initialSplits[member.id] = {
          amount:
            tab === "equal" ? (totalAmount / members.length).toFixed(2) : "",
          percentage: tab === "equal" ? (100 / members.length).toFixed(2) : ""
        };
      } else {
        initialSplits[member.id] = splits[member.id];
      }
    });

    if (tab === "equal") {
      const includedMembers = Object.keys(initialSplits);

      const amountPerPerson = getAmountPerPerson(
        totalAmount,
        includedMembers.length
      );
      const percentages = getPercentagePerPerson(includedMembers.length);

      let idx = 0;
      Object.keys(initialSplits).forEach((userId) => {
        initialSplits[userId].amount = amountPerPerson[idx]?.toFixed(2) || "";
        initialSplits[userId].percentage = percentages[idx]?.toFixed(2) || "";
        idx++;
      });
    } else {
      Object.keys(initialSplits).forEach((userId) => {
        initialSplits[userId].amount = "";
        initialSplits[userId].percentage = "";
      });
    }

    onSetSplits(initialSplits, tab);
  }, [tab, totalAmount, members]);

  const updateSplitAmount = (userId: string, amount: string) => {
    const newSplits = { ...splits };
    newSplits[userId].amount = amount;

    if (tab === "custom") {
      const percentage =
        totalAmount > 0
          ? (((parseFloat(amount) || 0) / totalAmount) * 100).toFixed(2)
          : "";
      newSplits[userId].percentage = percentage;
      newSplits[userId].amount = amount;
    }

    onSetSplits(newSplits, tab);
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

    onSetSplits(newSplits, tab);
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
    const includedCount = splits ? Object.values(splits).length : 0;

    return {
      amount: totalAmount,
      equalSplits: getAmountPerPerson(totalAmount, includedCount),
      includedCount
    };
  }, [splits]);
  const { equalSplits, includedCount } = expenseValues;

  return (
    <Fragment>
      <ScrollView className="flex-1">
        <VStack className="gap-y-4">
          <VStack className="px-4 gap-y-4">
            <StepperProgress currentStep={step} steps={3} />
            <VStack>
              <Text className="text-2xl" bold>
                Member Splits
              </Text>
              <Text className="text-secondary-950">
                Divide the total amount owed to each payer.
              </Text>
            </VStack>
          </VStack>

          <VStack className="gap-y-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <HStack className="gap-x-2 px-4">
                {splitTypes.map((type) => (
                  <FormButton
                    size="sm"
                    key={type.value}
                    variant={type.value === tab ? "solid" : "outline"}
                    className="flex-1 h-10"
                    text={type.label}
                    onPress={() => setTab(type.value)}
                  />
                ))}
              </HStack>
            </ScrollView>

            <FlatList
              scrollEnabled={false}
              className="flex-1 h-full"
              data={members}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={ListDivider}
              ListEmptyComponent={() => <EmptyList type={EmptyType.MEMBER} />}
              renderItem={({ item: member }) => (
                <MemberSplitItem
                  currency={currency}
                  member={member}
                  split={
                    splits[member.id] || {
                      amount: "",
                      percentage: ""
                    }
                  }
                  splitType={tab}
                  onAmountChange={(amount) =>
                    updateSplitAmount(member.id, amount)
                  }
                  onPercentageChange={(percentage) =>
                    updateSplitPercentage(member.id, percentage)
                  }
                />
              )}
            />
          </VStack>
        </VStack>
      </ScrollView>
      <Box className="p-4 bg-background-50 rounded-lg">
        {tab === "equal" && (
          <VStack>
            <Text className="text-xl font-medium">
              {formatAmount(totalAmount, currency)}
            </Text>
            <Text className="text-secondary-950">
              {formatAmount(equalSplits[0] || 0, currency)} per person
            </Text>
          </VStack>
        )}

        {tab === "percentage" && (
          <VStack>
            <Text className="text-xl font-medium">
              {formatAmount(totalAmount, currency)}
            </Text>
            <Text
              className={cn(
                totalPercentage > 100 ? "text-error-400" : "text-secondary-950"
              )}
            >
              {100 - totalPercentage}% left to allocate
            </Text>
          </VStack>
        )}

        {tab === "custom" && (
          <VStack>
            <Text className="text-xl font-medium">
              {formatAmount(totalAmount, currency)}
            </Text>
            <Text
              className={cn(
                totalSplitAmount > totalAmount
                  ? "text-error-400"
                  : "text-secondary-950"
              )}
            >
              {formatAmount(totalAmount - totalSplitAmount, currency)} left to
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

function MemberSplitItem({
  member,
  split,
  currency,
  splitType,
  onAmountChange,
  onPercentageChange
}: {
  member: Member;
  split: {
    amount: string;
    percentage: string;
  };
  currency: string;
  splitType: string;
  onAmountChange: (amount: string) => void;
  onPercentageChange: (percentage: string) => void;
}) {
  const { details: userDetails } = states.user();
  const isMe = member.id === userDetails?.id;

  const currencySign = useMemo(() => getCurrencySign(currency), [currency]);

  return (
    <Box className="p-4">
      <HStack className="gap-x-4 items-center">
        <HStack className="flex-1 items-center gap-x-2">
          <AppAvatar name={member.first_name} uri={member.avatar || ""} />
          <VStack>
            <Text className="text-lg">
              {member?.first_name} {member?.last_name} {isMe && "(You)"}
            </Text>
            <Text className="text-secondary-950">{member?.email}</Text>
          </VStack>
        </HStack>

        <VStack className="items-end">
          {splitType === "equal" && (
            <VStack className="items-end">
              <Text className="text-lg">
                {formatAmount(Number(split.amount) || 0, currency)}
              </Text>
              <Text className="text-secondary-950">{split.percentage}%</Text>
            </VStack>
          )}

          {splitType === "percentage" && (
            <VStack className="items-end gap-y-1">
              <Input className="text-right min-w-20" size="lg">
                <InputField
                  autoCapitalize="none"
                  keyboardType="numeric"
                  type="text"
                  placeholder="0"
                  value={split.percentage}
                  onChangeText={onPercentageChange}
                />
                <InputSlot className="mr-2">
                  <Text className="text-lg font-medium">%</Text>
                </InputSlot>
              </Input>
              <Text className="text-secondary-950">
                {formatAmount(Number(split.amount) || 0, currency)}
              </Text>
            </VStack>
          )}

          {splitType === "custom" && (
            <VStack className="items-end gap-y-1">
              <Input className="text-right min-w-28" size="lg">
                <InputSlot className="ml-2">
                  <Text className="text-lg font-medium">{currencySign}</Text>
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
                  onChangeText={onAmountChange}
                />
              </Input>

              <Text className="text-secondary-950">
                {split.percentage || 0}%
              </Text>
            </VStack>
          )}
        </VStack>
      </HStack>
    </Box>
  );
}
