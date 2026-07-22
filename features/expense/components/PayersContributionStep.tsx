import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import StepperProgress from "@/components/StepperProgress";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField, InputSlot } from "@/components/ui/input";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { Member } from "@/types/groups";
import { getCurrencySign } from "@/utils/currency";
import { getUserSubtitle } from "@/utils/userDisplay";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Fragment, useMemo } from "react";
import { formatAmount } from "../utils/formatAmount";

type PayersContributionStepProps = {
  step: number;
  amount: string;
  currency: string;
  members: Member[];
  payers: Record<string, { amount: string }>;
  onPayerAmountChange: (userId: string, amount: string) => void;
  /** Wipe every payer's entered contribution so the user can re-enter from
   * scratch. Omitted when the host doesn't need a reset affordance. */
  onClearAll?: () => void;
  isLockedGroup?: boolean;
  groupName?: string;
  /** Hidden when embedded outside the multi-step Edit Expense flow (e.g. Add
   * Expense's payer sheet), where there's no wizard to show progress for. */
  showStepper?: boolean;
  /** Hidden when the host already supplies its own title/description header
   * (e.g. Add Expense's payer sheet). */
  showHeader?: boolean;
};
export default function PayersContributionStep({
  step,
  amount,
  currency = "PHP",
  members,
  payers,
  onPayerAmountChange,
  onClearAll,
  isLockedGroup = false,
  groupName,
  showStepper = true,
  showHeader = true
}: PayersContributionStepProps) {
  const { details: userDetails } = states.user();
  const formattedPayers = useMemo(() => {
    return members
      .map((member) => ({
        ...member,
        amount: payers[member.id]?.amount || ""
      }))
      // Always surface "you" at the top of the list.
      .sort((a, b) =>
        a.id === userDetails?.id ? -1 : b.id === userDetails?.id ? 1 : 0
      );
  }, [members, payers, userDetails?.id]);

  const remainingAmount = useMemo(() => {
    const totalPayerAmount = formattedPayers.reduce((total, payer) => {
      const payerAmount = parseFloat(payer.amount || "0");
      return total + payerAmount;
    }, 0);

    return parseFloat(amount) - totalPayerAmount;
  }, [formattedPayers, amount]);

  const currencySign = useMemo(() => getCurrencySign(currency), [currency]);

  return (
    <Fragment>
      <ScrollView className="flex-1">
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
                  Who paid?
                </Text>
                <Text className="text-sm text-secondary-950">
                  Enter how much each person contributed to the expense.
                </Text>
              </VStack>
            </VStack>
          )}
          {onClearAll && (
            <HStack className="items-center justify-end">
              <FormButton
                variant="link"
                size="sm"
                text="Clear All"
                onPress={onClearAll}
              />
            </HStack>
          )}
          <FlatList
            scrollEnabled={false}
            data={formattedPayers}
            keyExtractor={(item) => item.id.toString()}
            ItemSeparatorComponent={() => (
              <Divider className="border-secondary-100" />
            )}
            renderItem={({ item: payer }) => (
              <PayerItem
                payer={payer}
                currencySign={currencySign}
                onAmountChange={onPayerAmountChange}
              />
            )}
            ListFooterComponent={() => <Box className="h-8" />}
          />
        </VStack>
      </ScrollView>
      <Box className="p-4 bg-background-50">
        <VStack>
          <Text className="text-xl font-medium">
            {formatAmount(parseFloat(amount), currency)}
          </Text>
          <Text
            className={cn(
              remainingAmount < 0 ? "text-error-400" : "text-secondary-950"
            )}
          >
            {formatAmount(remainingAmount, currency)} left to allocate
          </Text>
        </VStack>
      </Box>
    </Fragment>
  );
}

function PayerItem({
  payer,
  currencySign = "₱",
  onAmountChange
}: {
  payer: Member & { amount: string };
  currencySign?: string;
  onAmountChange: (id: string, amount: string) => void;
}) {
  const { details: userDetails } = states.user();
  const isMe = payer.id === userDetails?.id;

  return (
    <Box className="py-4">
      <HStack className="gap-x-4 items-center">
        <HStack className="flex-1 items-center gap-x-2">
          <AppAvatar name={payer.first_name} uri={payer.avatar || ""} />
          <VStack>
            <HStack className="gap-x-1 items-center">
              <Text className="text-lg">
                {payer.first_name} {payer.last_name}
                {isMe && " (You)"}
              </Text>
            </HStack>
            <Text className="text-sm text-secondary-950">
              {getUserSubtitle(payer)}
            </Text>
          </VStack>
        </HStack>

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
            value={payer.amount}
            onChangeText={(val) => onAmountChange(payer.id, val)}
          />
        </Input>
      </HStack>
    </Box>
  );
}
