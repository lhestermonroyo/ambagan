import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import { Avatar } from "@/components/ui/avatar";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { SectionList } from "@/components/ui/section-list";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import MarkAsSettledSheet from "@/features/expense/components/MarkAsSettledSheet";
import RequestSettledSheet from "@/features/expense/components/RequestSettledSheet";
import ReviewRequestPaidSheet from "@/features/expense/components/ReviewRequestPaidSheet";
import StatusBadge from "@/features/expense/components/StatusBadge";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { sortPaymentsByStatus } from "@/features/expense/utils/payment.util";
import services from "@/services";
import states from "@/states";
import { Payment } from "@/types/expenses";
import { getDateGroupTitle } from "@/utils/formatDate";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { format, parseISO } from "date-fns";
import { useFocusEffect } from "expo-router";
import { BanknoteArrowDown, BanknoteArrowUp } from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";

const settlementTabs = ["All", "Pending", "Requested", "Settled"] as const;

export default function GroupMySummary() {
  const { details, expenseList } = states.group.getState();
  const { details: userDetails } = states.user.getState();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [markAsSettledSheetOpen, setMarkAsSettledSheetOpen] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [reviewSheetReadOnly, setReviewSheetReadOnly] = useState(false);
  const [reviewIsPayer, setReviewIsPayer] = useState(false);
  const [settlementTab, setSettlementTab] =
    useState<(typeof settlementTabs)[number]>("All");

  useFocusEffect(
    useMemo(
      () => () => {
        if (details?.id && userDetails?.id) {
          fetchPayments();
        }
      },
      [details?.id, userDetails?.id]
    )
  );

  const fetchPayments = async () => {
    if (!details?.id || !userDetails?.id) return;
    setLoading(true);
    try {
      const data = await services.expense.getPaymentsByGroupAndUserId(
        details.id,
        userDetails.id
      );
      setPayments(sortPaymentsByStatus(data));
    } catch (error) {
      console.error("Error fetching group payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalGroupSpendings = useMemo(
    () => expenseList.reduce((sum, e) => sum + e.amount, 0),
    [expenseList]
  );

  const yourTotalPaid = useMemo(() => {
    if (!userDetails) return 0;
    return expenseList
      .flatMap((e) => e.payer_list)
      .filter((p) => p.payer.id === userDetails.id)
      .reduce((sum, p) => sum + p.amount, 0);
  }, [expenseList, userDetails]);

  const yourTotalUnpaid = useMemo(() => {
    if (!userDetails) return 0;
    return payments
      .filter(
        (p) =>
          p.member.id === userDetails.id &&
          (p.status === "pending" || p.status === "requested")
      )
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments, userDetails]);

  const settlementSections = useMemo(() => {
    const filtered =
      settlementTab === "All"
        ? payments
        : payments.filter((p) => p.status === settlementTab.toLowerCase());

    const groupedByDate: Record<string, Payment[]> = {};
    filtered.forEach((p) => {
      const dateKey = format(parseISO(p.created_at), "yyyy-MM-dd");
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(p);
    });

    return Object.keys(groupedByDate)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((dateKey) => ({
        title: getDateGroupTitle(dateKey + "T00:00:00"),
        data: groupedByDate[dateKey]
      }));
  }, [payments, settlementTab]);

  const yourToCollectTotal = useMemo(() => {
    if (!userDetails) return 0;
    return payments
      .filter(
        (p) =>
          p.payer.id === userDetails.id &&
          (p.status === "pending" || p.status === "requested")
      )
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments, userDetails]);

  const handleOpenRequest = (payment: Payment) => {
    setSelectedPayment(payment);
    setRequestSheetOpen(true);
  };

  const handleOpenMarkAsSettled = (payment: Payment) => {
    setSelectedPayment(payment);
    setMarkAsSettledSheetOpen(true);
  };

  const handleOpenReview = (payment: Payment, isPayer: boolean) => {
    setReviewSheetReadOnly(false);
    setReviewIsPayer(isPayer);
    setSelectedPayment(payment);
    setReviewSheetOpen(true);
  };

  return (
    <Fragment>
      <VStack className="gap-y-4">
        <HStack className="gap-x-2 px-4">
          <Card className="flex-1 rounded-lg bg-secondary-100">
            <Text className="text-2xl" bold>
              {formatAmount(totalGroupSpendings)}
            </Text>
            <Text className="text-secondary-950">Total Group Spendings</Text>
          </Card>
          <Card className="flex-1 rounded-lg bg-secondary-100">
            <Text className="text-2xl" bold>
              {formatAmount(yourTotalPaid)}
            </Text>
            <Text className="text-secondary-950">Your Total Paid</Text>
          </Card>
        </HStack>
        <HStack className="gap-x-2 px-4">
          <Card className="flex-1 rounded-lg bg-secondary-100">
            <Text className="text-2xl" bold>
              {formatAmount(yourTotalUnpaid)}
            </Text>
            <Text className="text-secondary-950">Your Total Unpaid</Text>
          </Card>

          <Card className="flex-1 rounded-lg bg-secondary-100">
            <Text className="text-2xl" bold>
              {formatAmount(yourToCollectTotal)}
            </Text>
            <Text className="text-secondary-950">Your Total To Collect</Text>
          </Card>
        </HStack>

        <Box className="mx-4">
          <Divider className="border-secondary-100" />
        </Box>

        <VStack className="gap-y-2">
          <Text bold className="text-xl px-4">
            Settlements
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack className="gap-x-2 px-4">
              {settlementTabs.map((t) => (
                <FormButton
                  key={t}
                  size="md"
                  variant={t === settlementTab ? "solid" : "outline"}
                  text={t}
                  onPress={() => setSettlementTab(t)}
                />
              ))}
            </HStack>
          </ScrollView>
          <LoadingWrapper isLoading={loading} text="Loading settlements...">
            <SectionList
              scrollEnabled={false}
              sections={settlementSections}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <SettlementItem
                  payment={item}
                  onOpenRequest={handleOpenRequest}
                  onOpenMarkAsSettled={handleOpenMarkAsSettled}
                  onOpenReview={handleOpenReview}
                />
              )}
              renderSectionHeader={({ section: { title } }) => (
                <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
                  <Text className="text-sm text-secondary-950">{title}</Text>
                </Box>
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
              ListEmptyComponent={() => (
                <Box className="px-4 py-8 items-center">
                  <Text className="text-secondary-950">
                    No settlements found
                  </Text>
                </Box>
              )}
              ListFooterComponent={() => <Box className="h-12" />}
              stickySectionHeadersEnabled={true}
            />
          </LoadingWrapper>
        </VStack>
      </VStack>

      {selectedPayment && (
        <RequestSettledSheet
          isOpen={requestSheetOpen}
          onClose={() => {
            setRequestSheetOpen(false);
            setSelectedPayment(null);
          }}
          payment={selectedPayment}
          onRefetch={fetchPayments}
        />
      )}
      {selectedPayment && (
        <MarkAsSettledSheet
          isOpen={markAsSettledSheetOpen}
          onClose={() => {
            setMarkAsSettledSheetOpen(false);
            setSelectedPayment(null);
          }}
          payment={selectedPayment}
          onRefetch={fetchPayments}
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
          onRefetch={fetchPayments}
          isPayer={reviewIsPayer}
          readOnly={reviewSheetReadOnly}
        />
      )}
    </Fragment>
  );
}

function SettlementItem({
  payment,
  onOpenRequest,
  onOpenMarkAsSettled,
  onOpenReview
}: {
  payment: Payment;
  onOpenRequest: (payment: Payment) => void;
  onOpenMarkAsSettled: (payment: Payment) => void;
  onOpenReview: (payment: Payment, isPayer: boolean) => void;
}) {
  const { details: userDetails } = states.user.getState();
  const isUserMember = payment.member.id === userDetails?.id;
  const isUserPayer = payment.payer.id === userDetails?.id;

  const handlePress = () => {
    if (isUserMember) {
      if (payment.status === "pending") {
        onOpenRequest(payment);
      } else {
        onOpenReview(payment, false);
      }
    } else if (isUserPayer) {
      if (payment.status === "requested") {
        onOpenReview(payment, true);
      } else if (payment.status === "pending") {
        onOpenMarkAsSettled(payment);
      } else {
        onOpenReview(payment, true);
      }
    }
  };

  return (
    <PressableListItem className="p-4" onPress={handlePress}>
      <HStack className="gap-x-2">
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
          </VStack>
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
