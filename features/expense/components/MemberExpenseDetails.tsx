import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { ExpensePayer, MemberSplit, Payment } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";
import { getPrimaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { FileImage } from "lucide-react-native";
import { Fragment, ReactNode, useMemo, useState } from "react";
import { formatAmount } from "../utils/formatAmount";
import RequestPaidSheet from "./RequestSettledSheet";
import ReviewRequestPaidSheet from "./ReviewRequestPaidSheet";
import StatusBadge from "./StatusBadge";

export default function MemberExpenseDetails({
  onRefetch
}: {
  onRefetch: () => void;
}) {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [reviewSheetReadOnly, setReviewSheetReadOnly] = useState(false);

  const { details: userDetails } = states.user();
  const {
    details: expenseDetails,
    paymentSplitList,
    payerList,
    memberSplitList
  } = states.expense.getState();

  const memberPaymentMap = useMemo(() => {
    const map: Record<string, Payment> = {};
    paymentSplitList.forEach((p) => {
      const existing = map[p.member.id];
      if (!existing || p.status !== "settled") {
        map[p.member.id] = p;
      }
    });
    return map;
  }, [paymentSplitList]);

  const splitShareAmount = useMemo(() => {
    if (!memberSplitList || !userDetails) return 0;
    return (
      memberSplitList.find((item) => item.member.id === userDetails.id)
        ?.amount || 0
    );
  }, [memberSplitList, userDetails]);

  const remainingOwed = useMemo(() => {
    if (!paymentSplitList || !userDetails) return 0;
    return paymentSplitList
      .filter((p) => p.member.id === userDetails.id && p.status !== "settled")
      .reduce((sum, p) => sum + p.amount, 0);
  }, [paymentSplitList, userDetails]);

  const handleMemberPress = (memberSplit: MemberSplit) => {
    const payment = memberPaymentMap[memberSplit.member.id];
    if (!payment) return;

    const isMyRow = memberSplit.member.id === userDetails?.id;

    if (!isMyRow) {
      setReviewSheetReadOnly(true);
      setSelectedPayment(payment);
      setReviewSheetOpen(true);
      return;
    }

    if (payment.status === "pending") {
      setSelectedPayment(payment);
      setRequestSheetOpen(true);
    } else {
      setReviewSheetReadOnly(false);
      setSelectedPayment(payment);
      setReviewSheetOpen(true);
    }
  };

  return (
    <Fragment>
      <VStack className="gap-y-6 pb-2">
        <VStack className="w-full gap-y-6 px-4">
          <VStack>
            <Text className="text-3xl" bold>
              {formatAmount(expenseDetails?.amount || 0)}
            </Text>
            <Text className="text-lg text-secondary-950">
              {expenseDetails?.description}
            </Text>
            <StatusBadge
              status={expenseDetails?.status || "ongoing"}
              size="lg"
            />
          </VStack>

          <HStack className="gap-x-2">
            <Card className="flex-1 bg-secondary-100 rounded-lg">
              <Text className="text-2xl" bold>
                {formatAmount(splitShareAmount)}
              </Text>
              <Text className="text-secondary-950">Your Share</Text>
            </Card>

            <Card
              className={cn(
                "flex-1 rounded-lg",
                remainingOwed > 0
                  ? "bg-error-50 border border-error-200"
                  : "bg-secondary-100"
              )}
            >
              <Text
                bold
                className={cn(
                  "text-2xl",
                  remainingOwed > 0 ? "text-error-700" : "text-secondary-950"
                )}
              >
                {remainingOwed === 0 ? "—" : formatAmount(remainingOwed)}
              </Text>
              <Text
                className={cn(
                  remainingOwed > 0 ? "text-error-700" : "text-secondary-950"
                )}
              >
                {remainingOwed > 0 ? "To Pay" : "All Settled Up"}
              </Text>
            </Card>
          </HStack>
        </VStack>

        <VStack className="gap-y-2 px-4">
          <Text className="text-xl" bold>
            Expense Details
          </Text>
          <Box className="bg-secondary-100 rounded-xl overflow-hidden">
            <DetailRow
              label="Expense Date"
              value={
                <Text>{formatDate(expenseDetails?.created_at || "")}</Text>
              }
            />
            <DetailRow
              label="Expense Creator"
              value={
                <HStack className="gap-x-1 items-center">
                  <AppAvatar
                    name={`${expenseDetails?.creator.first_name} ${expenseDetails?.creator.last_name}`}
                    uri={expenseDetails?.creator.avatar!}
                    size="sm"
                  />
                  <Text>
                    {expenseDetails?.creator.first_name}{" "}
                    {expenseDetails?.creator.last_name}
                    {expenseDetails?.creator.id === userDetails?.id && " (You)"}
                  </Text>
                </HStack>
              }
            />
            <DetailRow
              label="Split Type"
              value={
                <Text className="capitalize">{expenseDetails?.split_type}</Text>
              }
            />
            <DetailRow
              label="Proof of Payment"
              value={
                expenseDetails?.proof_of_payment ? (
                  <FormButton
                    size="md"
                    variant="outline"
                    text="View Image"
                    icon={
                      <FileImage
                        size={18}
                        color={getPrimaryHex("text-primary-500")}
                      />
                    }
                    onPress={() => {}}
                  />
                ) : (
                  <Text>N/A</Text>
                )
              }
            />
          </Box>
        </VStack>

        <VStack className="gap-y-4">
          <VStack className="gap-y-2">
            <Text className="text-xl px-4" bold>
              Members Split
            </Text>
            <FlatList
              className="flex-1"
              scrollEnabled={false}
              data={memberSplitList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <MemberSplitItem
                  memberSplit={item}
                  payment={memberPaymentMap[item.member.id]}
                  onPress={() => handleMemberPress(item)}
                />
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
            />
          </VStack>

          <VStack className="gap-y-2">
            <Text className="text-xl px-4" bold>
              Payers' Contribution
            </Text>
            <FlatList
              className="flex-1"
              scrollEnabled={false}
              data={payerList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => <PayerItem payer={item} />}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
            />
          </VStack>
        </VStack>
      </VStack>

      {selectedPayment && (
        <RequestPaidSheet
          isOpen={requestSheetOpen}
          onClose={() => {
            setRequestSheetOpen(false);
            setSelectedPayment(null);
          }}
          payment={selectedPayment}
          onRefetch={onRefetch}
        />
      )}
      {selectedPayment && (
        <ReviewRequestPaidSheet
          isOpen={reviewSheetOpen}
          onClose={() => {
            setReviewSheetOpen(false);
            setSelectedPayment(null);
            setReviewSheetReadOnly(false);
          }}
          payment={selectedPayment}
          onRefetch={onRefetch}
          isPayer={false}
          readOnly={reviewSheetReadOnly}
        />
      )}
    </Fragment>
  );
}

function MemberSplitItem({
  memberSplit,
  payment,
  onPress
}: {
  memberSplit: MemberSplit;
  payment?: Payment;
  onPress?: () => void;
}) {
  const { details: userDetails } = states.user();
  const isMe = memberSplit.member.id === userDetails?.id;

  return (
    <HStack className="gap-x-2 items-center p-4">
      <AppAvatar
        name={memberSplit.member.first_name}
        uri={memberSplit.member.avatar!}
        size="md"
      />
      <VStack className="flex-1">
        <Text className="text-lg">
          {memberSplit.member.first_name} {memberSplit.member.last_name}
          {isMe && " (You)"}
        </Text>
        <Text className="text-secondary-950">{memberSplit.member.email}</Text>
      </VStack>
      <VStack className="items-end gap-y-1">
        <Text className="text-lg">{formatAmount(memberSplit.amount)}</Text>
        <Text className="text-secondary-950 text-sm">
          {memberSplit.percentage}%
        </Text>
      </VStack>
    </HStack>
  );
}

function PayerItem({ payer }: { payer: ExpensePayer }) {
  const { details: userDetails } = states.user();
  const isMe = payer.payer.id === userDetails?.id;

  return (
    <HStack key={payer.id} className="p-4 items-center justify-between">
      <HStack className="gap-x-2 items-center flex-1">
        <AppAvatar
          name={payer.payer.first_name}
          uri={payer.payer.avatar!}
          size="md"
        />
        <VStack>
          <Text className="text-lg">
            {payer.payer.first_name} {payer.payer.last_name}
            {isMe && " (You)"}
          </Text>
          <Text className="text-secondary-950">{payer.payer.email}</Text>
        </VStack>
      </HStack>
      <Text className="text-lg">{formatAmount(payer.amount)}</Text>
    </HStack>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <HStack className="items-center justify-between p-4">
      <Text className="text-secondary-950">{label}</Text>
      {value}
    </HStack>
  );
}
