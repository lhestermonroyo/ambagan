import BalanceCard from "@/features/expense/components/BalanceCard";
import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
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
import SettlementItem from "@/features/expense/components/SettlementItem";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { sortPaymentsByStatus } from "@/features/expense/utils/payment.util";
import ViewBySheet, {
  ViewOption
} from "@/features/group/components/ViewBySheet";
import services from "@/services";
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { getDateGroupTitle } from "@/utils/formatDate";
import { getSecondaryHex } from "@/utils/getColorHex";
import { format, parseISO } from "date-fns";
import { useFocusEffect } from "expo-router";
import { ListFilter, ReceiptText } from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";

const settlementTabs = ["All", "Pending", "Requested", "Settled"] as const;

export default function GroupSettlements() {
  const { details, expenseList } = states.group.getState();
  const { details: userDetails } = states.user();

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
  const [viewBy, setViewBy] = useState<ViewOption>("By Date");
  const [viewSheetOpen, setViewSheetOpen] = useState(false);

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

  const netBalance = yourToCollectTotal - yourTotalUnpaid;

  const tabCounts = useMemo(() => {
    return {
      All: payments.length,
      Pending: payments.filter((p) => p.status === "pending").length,
      Requested: payments.filter((p) => p.status === "requested").length,
      Settled: payments.filter((p) => p.status === "settled").length
    };
  }, [payments]);

  const settlementSections = useMemo(() => {
    const filtered =
      settlementTab === "All"
        ? payments
        : payments.filter((p) => p.status === settlementTab.toLowerCase());

    if (viewBy === "By Expense") {
      const grouped: Record<string, Payment[]> = {};
      filtered.forEach((p) => {
        if (!grouped[p.expense_id]) grouped[p.expense_id] = [];
        grouped[p.expense_id].push(p);
      });
      return Object.keys(grouped).map((expenseId) => ({
        title: grouped[expenseId][0].expense_description || "Unknown Expense",
        data: grouped[expenseId]
      }));
    }

    if (viewBy === "By Person") {
      const grouped: Record<string, Payment[]> = {};
      filtered.forEach((p) => {
        const isUserMember = p.member.id === userDetails?.id;
        const other = isUserMember ? p.payer : p.member;
        if (!grouped[other.id]) grouped[other.id] = [];
        grouped[other.id].push(p);
      });
      return Object.keys(grouped).map((personId) => {
        const items = grouped[personId];
        const first = items[0];
        const isUserMember = first.member.id === userDetails?.id;
        const other = isUserMember ? first.payer : first.member;
        return {
          title: `${other.first_name} ${other.last_name}`,
          data: items
        };
      });
    }

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
  }, [payments, settlementTab, viewBy, userDetails]);

  const handleSettlementItemPress = (payment: PaymentPreview | Payment) => {
    const p = payment as Payment;
    const isUserMember = p.member.id === userDetails?.id;
    const isUserPayer = p.payer.id === userDetails?.id;

    if (isUserMember) {
      if (p.status === "pending") {
        handleOpenRequest(p);
      } else {
        handleOpenReview(p, false);
      }
    } else if (isUserPayer) {
      if (p.status === "requested") {
        handleOpenReview(p, true);
      } else if (p.status === "pending") {
        handleOpenMarkAsSettled(p);
      } else {
        handleOpenReview(p, true);
      }
    }
  };

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

  if (expenseList.length === 0) {
    return (
      <Box className="flex-1 items-center justify-center px-8 py-16">
        <ReceiptText
          size={48}
          className="text-secondary-300 mb-4"
          color="#CBD5E0"
        />
        <Text bold className="text-xl text-center mb-2">
          No expenses yet
        </Text>
        <Text className="text-secondary-950 text-center">
          Add an expense from the Expenses tab to start tracking who owes what.
        </Text>
      </Box>
    );
  }

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

          <BalanceCard balance={netBalance} className="flex-1" />
        </HStack>

        <HStack className="px-4 items-center justify-between">
          <Text bold className="text-xl">
            Settlements
          </Text>
          <Button
            variant="link"
            className="rounded-full"
            onPress={() => setViewSheetOpen(true)}
          >
            <ListFilter
              size={20}
              color={getSecondaryHex("text-secondary-950")}
            />
          </Button>
        </HStack>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <HStack className="gap-x-2 px-4">
            {settlementTabs.map((t) => (
              <FormButton
                key={t}
                size="md"
                variant={t === settlementTab ? "solid" : "outline"}
                text={`${t}${tabCounts[t] > 0 ? ` (${tabCounts[t]})` : ""}`}
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
              <SettlementItem item={item} onPress={handleSettlementItemPress} />
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
                <Text className="text-secondary-950">No settlements found</Text>
              </Box>
            )}
            ListFooterComponent={() => <Box className="h-12" />}
            stickySectionHeadersEnabled={true}
          />
        </LoadingWrapper>
      </VStack>

      <ViewBySheet
        isOpen={viewSheetOpen}
        onClose={() => setViewSheetOpen(false)}
        viewBy={viewBy}
        onSelect={setViewBy}
      />

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
