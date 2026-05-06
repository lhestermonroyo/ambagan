import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Avatar } from "@/components/ui/avatar";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { SectionList } from "@/components/ui/section-list";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import MarkAsSettledSheet from "@/features/expense/components/MarkAsSettledSheet";
import RequestSettledSheet from "@/features/expense/components/RequestSettledSheet";
import ReviewRequestPaidSheet from "@/features/expense/components/ReviewRequestPaidSheet";
import SettlementItem from "@/features/expense/components/SettlementItem";
import { sortPaymentsByStatus } from "@/features/expense/utils/payment.util";
import ViewBySheet, {
  ViewOption
} from "@/features/group/components/ViewBySheet";
import services from "@/services";
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { getDateGroupTitle } from "@/utils/formatDate";
import {
  getErrorHex,
  getPrimaryHex,
  getSecondaryHex,
  getSuccessHex
} from "@/utils/getColorHex";
import { format, parseISO } from "date-fns";
import { useFocusEffect } from "expo-router";
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  HouseHeart,
  LayoutList
} from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";

const settlementTabs = ["All", "Pending", "Requested", "Settled"] as const;

export default function GroupSettlements() {
  const { details, expenseList, settlementList } = states.group();
  const { details: userDetails } = states.user();

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
      states.group.setState((prev) => ({
        ...prev,
        settlementList: sortPaymentsByStatus(data)
      }));
    } catch (error) {
      console.error("Error fetching group payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const groupByCurrency = (items: { amount: number; currency: string }[]) => {
    const map: Record<string, number> = {};
    items.forEach(({ amount, currency }) => {
      map[currency] = (map[currency] ?? 0) + amount;
    });
    return Object.entries(map).map(([currency, amount]) => ({
      currency,
      amount
    }));
  };

  const totalGroupSpendingsByCurrency = useMemo(
    () => groupByCurrency(expenseList),
    [expenseList]
  );

  const yourTotalUnpaidByCurrency = useMemo(() => {
    if (!userDetails) return [];
    return groupByCurrency(
      settlementList.filter(
        (p) =>
          p.member.id === userDetails.id &&
          (p.status === "pending" || p.status === "requested")
      )
    );
  }, [settlementList, userDetails]);

  const yourToCollectTotalByCurrency = useMemo(() => {
    if (!userDetails) return [];
    return groupByCurrency(
      settlementList.filter(
        (p) =>
          p.payer.id === userDetails.id &&
          (p.status === "pending" || p.status === "requested")
      )
    );
  }, [settlementList, userDetails]);

  const tabCounts = useMemo(() => {
    return {
      All: settlementList.length,
      Pending: settlementList.filter((p) => p.status === "pending").length,
      Requested: settlementList.filter((p) => p.status === "requested").length,
      Settled: settlementList.filter((p) => p.status === "settled").length
    };
  }, [settlementList]);

  const settlementSections = useMemo(() => {
    const filtered =
      settlementTab === "All"
        ? settlementList
        : settlementList.filter(
            (p) => p.status === settlementTab.toLowerCase()
          );

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
  }, [settlementList, settlementTab, viewBy, userDetails]);

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

  return (
    <Fragment>
      <VStack className="gap-y-4">
        <HStack className="gap-x-2 px-4">
          <Card className="flex-1 rounded-lg bg-secondary-100">
            <VStack className="gap-y-2">
              <Avatar
                size="sm"
                className="bg-primary-100 border border-primary-200"
              >
                <HouseHeart
                  size={16}
                  color={getPrimaryHex("text-primary-600")}
                />
              </Avatar>
              <VStack className="gap-y-1">
                <CurrencyAmountDisplay
                  items={totalGroupSpendingsByCurrency}
                  label="Total Group Spendings"
                  type="neutral"
                />
                <Text className="text-secondary-950">
                  Total Group Spendings
                </Text>
              </VStack>
            </VStack>
          </Card>
        </HStack>

        <HStack className="gap-x-2 px-4">
          <Card className="flex-1 rounded-lg bg-secondary-100">
            <VStack className="gap-y-2 flex-1">
              <Avatar
                size="sm"
                className="bg-success-100 border border-success-200"
              >
                <BanknoteArrowUp
                  size={16}
                  color={getSuccessHex("text-success-600")}
                />
              </Avatar>
              <VStack className="flex-1 justify-between">
                <CurrencyAmountDisplay
                  items={yourToCollectTotalByCurrency}
                  label="To Collect"
                  type="receive"
                />
                <Text className="text-secondary-950">To Collect</Text>
              </VStack>
            </VStack>
          </Card>

          <Card className="flex-1 rounded-lg bg-secondary-100">
            <VStack className="gap-y-2 flex-1">
              <Avatar
                size="sm"
                className="bg-error-100 border border-error-200"
              >
                <BanknoteArrowDown
                  size={16}
                  color={getErrorHex("text-error-600")}
                />
              </Avatar>
              <VStack className="flex-1 justify-between">
                <CurrencyAmountDisplay
                  items={yourTotalUnpaidByCurrency}
                  label="To Pay"
                  type="pay"
                />
                <Text className="text-secondary-950">To Pay</Text>
              </VStack>
            </VStack>
          </Card>
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
            <LayoutList
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
            ListFooterComponent={() => <Box className="h-16" />}
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
