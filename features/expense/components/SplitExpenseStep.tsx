import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import SelectField from "@/components/SelectField";
import StepperProgress from "@/components/StepperProgress";
import { Box } from "@/components/ui/box";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField, InputSlot } from "@/components/ui/input";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { Member } from "@/types/groups";
import { splitTypes } from "@/utils/constants";
import { getCurrencySign } from "@/utils/currency";
import { getUserSubtitle } from "@/utils/userDisplay";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { formatAmount } from "../utils/formatAmount";
import {
  getAmountPerPerson,
  getPercentagePerPerson,
  isPayerOnlySplit
} from "../utils/split.util";
import SplitMembersSheet from "./SplitMembersSheet";

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
  /** The expense's effective payer id(s). When a lone payer is also the only
   * member in the split, the expense nets to zero — we flag it here. Optional so
   * other callers (e.g. edit-expense) that don't pass it keep working. */
  payerIds?: string[];
  isLockedGroup?: boolean;
  groupName?: string;
  /** Pre-select a split tab (e.g. when editing an existing expense). */
  initialTab?: (typeof splitTypes)[number]["value"];
  /**
   * Skip the auto-distribute/clear on the first effect run so seeded splits
   * (from an expense being edited) are preserved. Subsequent tab/amount
   * changes still recompute as usual.
   */
  skipInitialReset?: boolean;
  /** Hidden when embedded outside the multi-step Edit Expense flow (e.g. Add
   * Expense's split sheet), where there's no wizard to show progress for. */
  showStepper?: boolean;
  /** Hidden when the host already supplies its own title/description header
   * (e.g. Add Expense's split sheet). */
  showHeader?: boolean;
};

export default function SplitSelection({
  step,
  amount,
  currency,
  members,
  splits,
  onSetSplits,
  payerIds = [],
  isLockedGroup = false,
  groupName,
  initialTab,
  skipInitialReset = false,
  showStepper = true,
  showHeader = true
}: SplitExpenseStepProps) {
  const [tab, setTab] = useState<(typeof splitTypes)[number]["value"]>(
    initialTab ?? splitTypes[0].value
  );
  const initialResetSkipped = useRef(false);

  const totalAmount = parseFloat(amount) || 0;

  // Members excluded from this split. Seeded when editing an existing expense
  // (members without a stored split are treated as excluded); empty for a fresh
  // expense/draft where everyone starts included.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => {
    if (!skipInitialReset) return new Set<string>();
    const excluded = new Set<string>();
    members.forEach((member) => {
      const split = splits[member.id];
      if (!split || !(parseFloat(split.amount) > 0)) excluded.add(member.id);
    });
    return excluded;
  });
  const [membersSheetOpen, setMembersSheetOpen] = useState(false);

  const includedMembers = useMemo(
    () => members.filter((member) => !excludedIds.has(member.id)),
    [members, excludedIds]
  );

  // Equal split: split the total evenly across the currently-included members;
  // excluded members are zeroed so they drop from the final split.
  const distributeEqual = (excluded: Set<string>): Splits => {
    const included = members.filter((member) => !excluded.has(member.id));
    const amountPerPerson = getAmountPerPerson(totalAmount, included.length);
    const percentages = getPercentagePerPerson(included.length);
    const next: Splits = {};
    let idx = 0;
    members.forEach((member) => {
      if (excluded.has(member.id)) {
        next[member.id] = { amount: "", percentage: "" };
      } else {
        next[member.id] = {
          amount: amountPerPerson[idx]?.toFixed(2) || "",
          percentage: percentages[idx]?.toFixed(2) || ""
        };
        idx++;
      }
    });
    return next;
  };

  const clearAll = (): Splits => {
    const next: Splits = {};
    members.forEach((member) => {
      next[member.id] = { amount: "", percentage: "" };
    });
    return next;
  };

  // Wipe every member's entered amount/percentage so the user can re-enter the
  // split from scratch. Only exposed on the manual tabs (percentage / custom).
  const handleClearAll = () => {
    onSetSplits(clearAll(), tab);
  };

  // Recompute splits from scratch on tab / amount / member changes: equal
  // redistributes across included members, other tabs clear for re-entry.
  useEffect(() => {
    if (skipInitialReset && !initialResetSkipped.current) {
      initialResetSkipped.current = true;
      return;
    }

    onSetSplits(
      tab === "equal" ? distributeEqual(excludedIds) : clearAll(),
      tab
    );
  }, [tab, totalAmount, members]);

  const handleSaveIncludedMembers = (nextIncluded: Set<string>) => {
    const nextExcluded = new Set(
      members.map((member) => member.id).filter((id) => !nextIncluded.has(id))
    );
    setExcludedIds(nextExcluded);

    if (tab === "equal") {
      onSetSplits(distributeEqual(nextExcluded), tab);
    } else {
      // Preserve amounts already entered for still-included members; only zero
      // out the ones now excluded so they drop from the final split.
      const next: Splits = { ...splits };
      members.forEach((member) => {
        if (nextExcluded.has(member.id) || !next[member.id]) {
          next[member.id] = { amount: "", percentage: "" };
        }
      });
      onSetSplits(next, tab);
    }
  };

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

  const includedCount = includedMembers.length;
  const equalSplits = useMemo(
    () => getAmountPerPerson(totalAmount, includedCount),
    [totalAmount, includedCount]
  );

  // The lone payer is also the only member sharing the expense — nothing to
  // settle. Blocks Save Changes in the host sheet (via its own check) and shows
  // an inline reason here.
  const payerOnly = isPayerOnlySplit(
    payerIds,
    includedMembers.map((member) => member.id)
  );

  return (
    <Fragment>
      <ScrollView className="flex-1">
        <VStack className="gap-y-4">
          {(showStepper || showHeader) && (
            <VStack className="px-4 gap-y-4">
              {showStepper && <StepperProgress currentStep={step} steps={3} />}
              {showHeader && (
                <VStack className="gap-y-1">
                  {isLockedGroup && groupName && (
                    <Text
                      className="text-sm text-secondary-950 uppercase"
                      bold
                      numberOfLines={1}
                    >
                      {groupName}
                    </Text>
                  )}
                  <VStack>
                    <Text className="text-2xl" bold>
                      Who owes what?
                    </Text>
                    <Text className="text-sm text-secondary-950">
                      Set how the total is divided among each member.
                    </Text>
                  </VStack>
                </VStack>
              )}
            </VStack>
          )}

          <VStack className="gap-y-2">
            <VStack className="gap-y-4">
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

              <Box className="px-4">
                <SelectField
                  onPress={() => setMembersSheetOpen(true)}
                  leading={<Icon as="group" className="text-secondary-950" />}
                  trailingIcon="expand-more"
                >
                  <Text className="text-base" numberOfLines={1}>
                    Split among {includedCount} of {members.length}
                  </Text>
                </SelectField>
              </Box>

              {tab !== "equal" && includedCount > 0 && (
                <HStack className="px-4 items-center justify-end">
                  <FormButton
                    variant="link"
                    size="sm"
                    text="Clear All"
                    onPress={handleClearAll}
                  />
                </HStack>
              )}
            </VStack>

            <FlatList
              scrollEnabled={false}
              data={includedMembers}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={ListDivider}
              ListEmptyComponent={() => <EmptyList type={EmptyType.MEMBER} />}
              ListFooterComponent={() => <Box className="h-8" />}
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
      <Box className="p-4 bg-background-50">
        {tab === "equal" && (
          <VStack>
            <Text className="text-xl font-medium">
              {formatAmount(totalAmount, currency)}
            </Text>
            <Text className="text-sm text-secondary-950">
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

        {includedCount === 1 &&
          (payerOnly ? (
            <Text className="text-error-500 text-sm mt-2">
              This person also paid for the expense, so there&apos;s nothing to
              settle. Include someone else to split with.
            </Text>
          ) : (
            <Text className="text-secondary-950 text-sm mt-2">
              Only 1 member is included in this split — they&apos;ll cover the
              full amount.
            </Text>
          ))}
      </Box>

      <SplitMembersSheet
        isOpen={membersSheetOpen}
        onClose={() => setMembersSheetOpen(false)}
        members={members}
        includedIds={new Set(includedMembers.map((member) => member.id))}
        onSave={handleSaveIncludedMembers}
      />
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
        <HStack className="flex-1 items-center gap-x-3">
          <AppAvatar
            name={member.first_name}
            uri={member.avatar || ""}
            isPlaceholder={member.is_placeholder}
          />
          <VStack>
            <Text className="text-lg">
              {member?.first_name} {member?.last_name} {isMe && "(You)"}
            </Text>
            <Text className="text-sm text-secondary-950">
              {getUserSubtitle(member)}
            </Text>
          </VStack>
        </HStack>

        <VStack className="items-end">
          {splitType === "equal" && (
            <VStack className="items-end">
              <Text className="text-lg">
                {formatAmount(Number(split.amount) || 0, currency)}
              </Text>
              <Text className="text-sm text-secondary-950">
                {split.percentage}%
              </Text>
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
              <Text className="text-sm text-secondary-950">
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

              <Text className="text-sm text-secondary-950">
                {split.percentage || 0}%
              </Text>
            </VStack>
          )}
        </VStack>
      </HStack>
    </Box>
  );
}
