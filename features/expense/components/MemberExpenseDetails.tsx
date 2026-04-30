import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Avatar } from "@/components/ui/avatar";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { ExpensePayer, MemberSplit, Payment } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";
import { getPrimaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import {
  ArrowLeftRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  FileImage
} from "lucide-react-native";
import { Fragment, ReactNode, useMemo, useState } from "react";
import { formatAmount } from "../utils/formatAmount";
import RequestPaidSheet from "./RequestPaidSheet";
import ReviewRequestPaidSheet from "./ReviewRequestPaidSheet";
import StatusBadge from "./StatusBadge";

const tabs = ["Settlements", "Split Breakdown", "Expense Details"] as const;

export default function MemberExpenseDetails({
  onRefetch
}: {
  onRefetch: () => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Settlements");
  const [showMembers, setShowMembers] = useState(false);
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

  const filteredPayments = useMemo(() => {
    if (!paymentSplitList || !userDetails) return [];
    if (!showMembers) {
      return paymentSplitList.filter(
        (p) => p.member.id === userDetails.id || p.payer.id === userDetails.id
      );
    }
    return paymentSplitList;
  }, [paymentSplitList, userDetails, showMembers]);

  const splitShareAmount = useMemo(() => {
    if (!memberSplitList || !userDetails) return 0;
    return (
      memberSplitList.find((item) => item.member.id === userDetails.id)
        ?.amount || 0
    );
  }, [memberSplitList, userDetails]);

  const isCompleted = useMemo(() => {
    if (!paymentSplitList || !userDetails) return false;
    const myPayments = paymentSplitList.filter(
      (p) => p.member.id === userDetails.id
    );
    return (
      myPayments.length > 0 && myPayments.every((p) => p.status === "settled")
    );
  }, [paymentSplitList, userDetails]);

  const handleOpenRequest = (payment: Payment) => {
    setSelectedPayment(payment);
    setRequestSheetOpen(true);
  };

  const handleOpenReview = (payment: Payment) => {
    setReviewSheetReadOnly(false);
    setSelectedPayment(payment);
    setReviewSheetOpen(true);
  };

  const handleOpenReadOnlyReview = (payment: Payment) => {
    setReviewSheetReadOnly(true);
    setSelectedPayment(payment);
    setReviewSheetOpen(true);
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
          </VStack>

          <HStack className="gap-x-2">
            <Card className="flex-1 border rounded-lg border-secondary-400">
              <Text className="text-2xl" bold>
                {formatAmount(splitShareAmount)}
              </Text>
              <Text className="text-secondary-950">Your Share</Text>
            </Card>

            <Card className="flex-1 border rounded-lg border-secondary-400 justify-center">
              <StatusBadge
                status={isCompleted ? "completed" : "ongoing"}
                size="lg"
              />
              <Text className="text-secondary-950">Settlement Status</Text>
            </Card>
          </HStack>
        </VStack>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <HStack className="gap-x-2 px-4">
            {tabs.map((type) => (
              <FormButton
                size="md"
                key={type}
                variant={type === tab ? "solid" : "outline"}
                text={type}
                onPress={() => setTab(type)}
              />
            ))}
          </HStack>
        </ScrollView>

        {tab === "Settlements" && (
          <VStack className="gap-y-2">
            <HStack className="items-center justify-end gap-x-2 px-4 py-2 bg-secondary-100">
              <Text className="text-secondary-950">Show all members</Text>
              <Switch
                size="md"
                value={showMembers}
                onValueChange={setShowMembers}
              />
            </HStack>
            <FlatList
              className="flex-1"
              scrollEnabled={false}
              data={filteredPayments}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <ExpenseSplitItem
                  key={item.member.id}
                  payment={item}
                  onOpenRequest={handleOpenRequest}
                  onOpenReview={handleOpenReview}
                  onOpenReadOnlyReview={handleOpenReadOnlyReview}
                />
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
              ListEmptyComponent={() => (
                <Box className="px-4 py-8 items-center">
                  <Text className="text-secondary-950">No payments found</Text>
                </Box>
              )}
              ListFooterComponent={() => <Box className="h-12" />}
            />
          </VStack>
        )}

        {tab === "Split Breakdown" && (
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
                  <MemberSplitItem key={item.member.id} memberSplit={item} />
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
                renderItem={({ item }) => (
                  <PayerItem key={item.id} payer={item} />
                )}
                ItemSeparatorComponent={() => (
                  <Box className="mx-4">
                    <Divider className="border-secondary-100" />
                  </Box>
                )}
              />
            </VStack>
          </VStack>
        )}

        {tab === "Expense Details" && (
          <VStack className="gap-y-4 px-4">
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
                      {expenseDetails?.creator.id === userDetails?.id &&
                        " (You)"}
                    </Text>
                  </HStack>
                }
              />
              <DetailRow
                label="Split Type"
                value={
                  <Text className="capitalize">
                    {expenseDetails?.split_type}
                  </Text>
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
        )}
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

function ExpenseSplitItem({
  payment,
  onOpenRequest,
  onOpenReview,
  onOpenReadOnlyReview
}: {
  payment: Payment;
  onOpenRequest: (payment: Payment) => void;
  onOpenReview: (payment: Payment) => void;
  onOpenReadOnlyReview: (payment: Payment) => void;
}) {
  const { details: userDetails } = states.user();
  const isUserMember = payment?.member.id === userDetails?.id;
  const isUserPayer = payment?.payer.id === userDetails?.id;

  const actionHint = (() => {
    if (payment.status === "settled") return "View details";
    if (!isUserMember && !isUserPayer) return "View details";
    if (isUserMember && payment.status === "pending") return "Tap to send proof";
    if (isUserMember && payment.status === "requested") return "Waiting for approval";
    return null;
  })();

  const handlePress = () => {
    if (!isUserMember && !isUserPayer) {
      onOpenReadOnlyReview(payment);
      return;
    }

    if (payment.status === "pending") {
      onOpenRequest(payment);
    } else {
      onOpenReview(payment);
    }
  };

  return (
    <PressableListItem className="p-4" onPress={handlePress}>
      <HStack className="gap-x-2">
        {!isUserMember && !isUserPayer ? (
          <Avatar size="sm" className="bg-warning-400">
            <ArrowLeftRight size={16} color="#FFFFFF" />
          </Avatar>
        ) : (
          <Avatar
            size="sm"
            className={cn(isUserPayer ? "bg-success-400" : "bg-error-400")}
          >
            {isUserPayer ? (
              <BanknoteArrowDown size={16} color="#FFFFFF" />
            ) : (
              <BanknoteArrowUp size={16} color="#FFFFFF" />
            )}
          </Avatar>
        )}

        <VStack className="flex-1">
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {payment.member.first_name} {payment.member.last_name}
              {isUserMember && " (You)"}
            </Text>
          </HStack>
          <Text className="text-sm text-secondary-950">pays</Text>
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {payment.payer.first_name} {payment.payer.last_name}
              {isUserPayer && " (You)"}
            </Text>
          </HStack>
        </VStack>
        <HStack className="gap-x-2 items-center">
          <VStack className="items-end">
            <Text className="text-lg">{formatAmount(payment.amount)}</Text>
            <StatusBadge status={payment.status} size="lg" />
            {actionHint && (
              <Text className="text-xs text-secondary-950">{actionHint}</Text>
            )}
          </VStack>
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}

function MemberSplitItem({ memberSplit }: { memberSplit: MemberSplit }) {
  const { details: userDetails } = states.user();
  const isMe = memberSplit.member.id === userDetails?.id;

  return (
    <HStack key={memberSplit.id} className="p-4 items-center justify-between">
      <HStack className="gap-x-2 items-center flex-1">
        <AppAvatar
          name={memberSplit.member.first_name}
          uri={memberSplit.member.avatar!}
          size="md"
        />
        <VStack>
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {memberSplit.member.first_name} {memberSplit.member.last_name}
              {isMe && " (You)"}
            </Text>
          </HStack>
          <Text className="text-secondary-950">{memberSplit.member.email}</Text>
        </VStack>
      </HStack>
      <VStack className="items-end">
        <Text className="text-lg">{formatAmount(memberSplit.amount)}</Text>
        <Text className="text-secondary-950">{memberSplit.percentage}%</Text>
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
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {payer.payer.first_name} {payer.payer.last_name}
              {isMe && " (You)"}
            </Text>
          </HStack>
          <Text className="text-secondary-950">{payer.payer.email}</Text>
        </VStack>
      </HStack>
      <VStack className="items-end">
        <Text className="text-lg">{formatAmount(payer.amount)}</Text>
      </VStack>
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
