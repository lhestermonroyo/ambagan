import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { ExpensePayer, MemberSplit, Payment } from "@/types/expenses";
import { Fragment, useMemo, useState } from "react";
import { formatAmount } from "../utils/formatAmount";
import BalanceCard from "./BalanceCard";
import ExpenseDetailsSheet from "./ExpenseDetailsSheet";
import RequestPaidSheet from "./RequestSettledSheet";
import ReviewRequestPaidSheet from "./ReviewRequestPaidSheet";
import StatusBadge from "./StatusBadge";

export default function MemberExpenseDetails({
  onRefetch
}: {
  onRefetch: () => void;
}) {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [expenseInfoSheetOpen, setExpenseInfoSheetOpen] = useState(false);
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

  const sortedMemberSplitList = useMemo(() => {
    return [...memberSplitList].sort((a, b) => {
      const aHasPayment = !!memberPaymentMap[a.member.id];
      const bHasPayment = !!memberPaymentMap[b.member.id];
      if (aHasPayment === bHasPayment) return 0;
      return aHasPayment ? -1 : 1;
    });
  }, [memberSplitList, memberPaymentMap]);

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
        <VStack className="w-full gap-y-4 px-4">
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

          <FormButton
            variant="outline"
            text="Expense Info"
            onPress={() => setExpenseInfoSheetOpen(true)}
          />

          <HStack className="gap-x-2">
            <Card className="flex-1 bg-secondary-100 rounded-lg">
              <Text className="text-2xl" bold>
                {formatAmount(splitShareAmount)}
              </Text>
              <Text className="text-secondary-950">Your Share</Text>
            </Card>

            <BalanceCard balance={-remainingOwed} className="flex-1" />
          </HStack>
        </VStack>

        <VStack className="gap-y-4">
          <VStack className="gap-y-2">
            <Text className="text-xl px-4" bold>
              Members Split
            </Text>
            <FlatList
              className="flex-1"
              scrollEnabled={false}
              data={sortedMemberSplitList}
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

      <ExpenseDetailsSheet
        isOpen={expenseInfoSheetOpen}
        onClose={() => setExpenseInfoSheetOpen(false)}
      />
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

  if (!payment || !onPress) {
    return (
      <HStack className="p-4 gap-x-2 items-center">
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
        <HStack className="gap-x-1 items-center">
          <VStack className="items-end gap-y-1">
            <Text className="text-lg">{formatAmount(memberSplit.amount)}</Text>
          </VStack>
          <Icon as="chevron-right" className="text-secondary-500" />
        </HStack>
      </HStack>
    );
  }

  return (
    <PressableListItem onPress={onPress}>
      <HStack className="p-4 gap-x-2 items-center">
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
        <HStack className="gap-x-1 items-center">
          <VStack className="items-end gap-y-1">
            <Text className="text-lg">{formatAmount(memberSplit.amount)}</Text>
            <StatusBadge status={payment?.status || "pending"} size="md" />
          </VStack>
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
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

