import AppAvatar from "@/components/AppAvatar";
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
  isLockedGroup?: boolean;
  groupName?: string;
};
export default function PayersContributionStep({
  step,
  amount,
  currency = "PHP",
  members,
  payers,
  onPayerAmountChange,
  isLockedGroup = false,
  groupName
}: PayersContributionStepProps) {
  const formattedPayers = useMemo(() => {
    return members.map((member) => ({
      ...member,
      amount: payers[member.id]?.amount || ""
    }));
  }, [members, payers]);

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
          <StepperProgress currentStep={step} steps={3} />
          <VStack>
            {isLockedGroup && groupName && (
              <Text className="font-medium text-lg">{groupName}</Text>
            )}
            <Text className="text-2xl" bold>
              Who paid?
            </Text>
            <Text className="text-secondary-950">
              Enter how much each person contributed to the expense.
            </Text>
          </VStack>
          <FlatList
            className="flex-1 h-full"
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
            <Text className="text-secondary-950">{payer.email}</Text>
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
