import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Avatar } from "@/components/ui/avatar";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { SectionList } from "@/components/ui/section-list";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import MarkAsSettledSheet from "@/features/expense/components/MarkAsSettledSheet";
import RequestSettledSheet from "@/features/expense/components/RequestSettledSheet";
import ReviewRequestPaidSheet from "@/features/expense/components/ReviewRequestPaidSheet";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import SettlementItem from "@/features/expense/components/SettlementItem";
import { sortPaymentsByStatus } from "@/features/expense/utils/payment.util";
import DateRangeSheet, {
  DateRangeOption,
  dateRangeLabels,
  getDateRangeCutoff
} from "@/features/group/components/DateRangeSheet";
import ViewBySheet, {
  ViewOption
} from "@/features/group/components/ViewBySheet";
import services from "@/services";
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { getDateGroupTitle } from "@/utils/formatDate";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { format, parseISO } from "date-fns";
import { useFocusEffect } from "expo-router";
import { CalendarRange, HouseHeart, LayoutList, X } from "lucide-react-native";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";

const settlementTabs = ["All", "Pending", "Requested", "Settled"] as const;

export default function GroupSettlements({
  refreshTrigger = 0
}: {
  refreshTrigger?: number;
}) {
  const { details, expenseList } = states.group();
  const { details: userDetails, defaultCurrency } = states.user();
  const colorScheme = useColorScheme() ?? "light";

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activePayments, setActivePayments] = useState<Payment[]>([]);
  const [settledPayments, setSettledPayments] = useState<Payment[]>([]);
  const [settledPage, setSettledPage] = useState(0);
  const [hasMoreSettled, setHasMoreSettled] = useState(false);
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
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);
  const initializedRef = useRef(false);

  useFocusEffect(
    useMemo(
      () => () => {
        if (details?.id && userDetails?.id) {
          fetchAll();
        }
      },
      [details?.id, userDetails?.id]
    )
  );

  useEffect(() => {
    if (refreshTrigger > 0 && details?.id && userDetails?.id) {
      fetchAll();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (!details?.id || !userDetails?.id) return;
    const cutoff = getDateRangeCutoff(dateRange);
    setSettledPayments([]);
    setSettledPage(0);
    fetchSettled(0, cutoff);
  }, [dateRange]);

  const fetchAll = async () => {
    if (!details?.id || !userDetails?.id) return;
    setLoading(true);
    try {
      const cutoff = getDateRangeCutoff(dateRange);
      const [active, settled] = await Promise.all([
        services.expense.getActivePaymentsByGroupAndUserId(details.id, userDetails.id),
        services.expense.getSettledPaymentsByGroupAndUserId(details.id, userDetails.id, { cutoff, page: 0 })
      ]);
      setActivePayments(sortPaymentsByStatus(active));
      setSettledPayments(settled.data);
      setSettledPage(0);
      setHasMoreSettled(settled.hasNext);
      states.group.setState((prev) => ({
        ...prev,
        settlementList: sortPaymentsByStatus([...active, ...settled.data])
      }));
      initializedRef.current = true;
    } catch (error) {
      console.error("Error fetching group payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettled = async (page: number, cutoff: Date | null) => {
    if (!details?.id || !userDetails?.id) return;
    try {
      const result = await services.expense.getSettledPaymentsByGroupAndUserId(
        details.id,
        userDetails.id,
        { cutoff, page }
      );
      setSettledPayments((prev) => (page === 0 ? result.data : [...prev, ...result.data]));
      setSettledPage(page);
      setHasMoreSettled(result.hasNext);
    } catch (error) {
      console.error("Error fetching settled payments:", error);
    }
  };

  const loadMoreSettled = async () => {
    setLoadingMore(true);
    try {
      await fetchSettled(settledPage + 1, getDateRangeCutoff(dateRange));
    } finally {
      setLoadingMore(false);
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
    return groupByCurrency(activePayments.filter((p) => p.member.id === userDetails.id));
  }, [activePayments, userDetails]);

  const yourToCollectTotalByCurrency = useMemo(() => {
    if (!userDetails) return [];
    return groupByCurrency(activePayments.filter((p) => p.payer.id === userDetails.id));
  }, [activePayments, userDetails]);

  const settlementSections = useMemo(() => {
    const cutoff = getDateRangeCutoff(dateRange);

    let filtered: Payment[];
    if (settlementTab === "Settled") {
      filtered = settledPayments;
    } else if (settlementTab === "Pending") {
      filtered = activePayments
        .filter((p) => p.status === "pending")
        .filter((p) => !cutoff || new Date(p.created_at) >= cutoff);
    } else if (settlementTab === "Requested") {
      filtered = activePayments
        .filter((p) => p.status === "requested")
        .filter((p) => !cutoff || new Date(p.created_at) >= cutoff);
    } else {
      const activeFiltered = activePayments.filter(
        (p) => !cutoff || new Date(p.created_at) >= cutoff
      );
      filtered = [...activeFiltered, ...settledPayments];
    }

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
  }, [activePayments, settledPayments, settlementTab, viewBy, userDetails, dateRange]);

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
      <VStack className="gap-y-8">
        <VStack className="gap-y-2">
          <HStack className="gap-x-2 px-4">
            <Card className="flex-1 rounded-lg bg-secondary-100">
              <VStack className="gap-y-2">
                <Avatar
                  size="sm"
                  className="bg-primary-100 border border-primary-200"
                >
                  <HouseHeart
                    size={16}
                    color={getPrimaryHex("text-primary-600", colorScheme)}
                  />
                </Avatar>
                <VStack className="gap-y-1">
                  <CurrencyAmountDisplay
                    isLoading={loading}
                    items={totalGroupSpendingsByCurrency}
                    label="Total Group Spendings"
                    type="neutral"
                    primaryCurrency={defaultCurrency}
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
              <VStack className="gap-y-2">
                <SettlementAvatar isPayer={true} />
                <VStack className="justify-between">
                  <CurrencyAmountDisplay
                    isLoading={loading}
                    items={yourToCollectTotalByCurrency}
                    label="To Collect"
                    type="receive"
                    primaryCurrency={defaultCurrency}
                  />
                  <Text className="text-secondary-950">To Collect</Text>
                </VStack>
              </VStack>
            </Card>

            <Card className="flex-1 rounded-lg bg-secondary-100">
              <VStack className="gap-y-2">
                <SettlementAvatar isPayer={false} />
                <VStack className="justify-between">
                  <CurrencyAmountDisplay
                    isLoading={loading}
                    items={yourTotalUnpaidByCurrency}
                    label="To Pay"
                    type="pay"
                    primaryCurrency={defaultCurrency}
                  />
                  <Text className="text-secondary-950">To Pay</Text>
                </VStack>
              </VStack>
            </Card>
          </HStack>
        </VStack>

        <VStack className="gap-y-4">
          <HStack>
            <ScrollView
              horizontal
              className="flex-1"
              showsHorizontalScrollIndicator={false}
            >
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
            <HStack className="gap-x-4 px-4">
              <Button
                variant="link"
                className="rounded-full"
                onPress={() => setDateRangeSheetOpen(true)}
              >
                <CalendarRange
                  color={
                    dateRange !== "All"
                      ? getPrimaryHex("text-primary-400", colorScheme)
                      : getSecondaryHex("text-secondary-950", colorScheme)
                  }
                />
              </Button>
              <Button
                variant="link"
                className="rounded-full"
                onPress={() => setViewSheetOpen(true)}
              >
                <LayoutList
                  color={
                    viewBy !== "By Date"
                      ? getPrimaryHex("text-primary-400", colorScheme)
                      : getSecondaryHex("text-secondary-950", colorScheme)
                  }
                />
              </Button>
            </HStack>
          </HStack>

          {(dateRange !== "All" || viewBy !== "By Date") && (
            <HStack className="gap-x-2 px-4 flex-wrap">
              {dateRange !== "All" && (
                <Pressable
                  onPress={() => setDateRange("All")}
                  className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                >
                  <Text className="text-sm text-primary-600">
                    {dateRangeLabels[dateRange]}
                  </Text>
                  <X
                    size={12}
                    color={getPrimaryHex("text-primary-600", colorScheme)}
                  />
                </Pressable>
              )}
              {viewBy !== "By Date" && (
                <Pressable
                  onPress={() => setViewBy("By Date")}
                  className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                >
                  <Text className="text-sm text-primary-600">{viewBy}</Text>
                  <X
                    size={12}
                    color={getPrimaryHex("text-primary-600", colorScheme)}
                  />
                </Pressable>
              )}
            </HStack>
          )}

          <LoadingWrapper isLoading={loading} text="Loading settlements...">
            <SectionList
              scrollEnabled={false}
              sections={settlementSections}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <SettlementItem
                  item={item}
                  onPress={handleSettlementItemPress}
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
                <EmptyList
                  type={
                    settlementTab === "Pending"
                      ? EmptyType.SETTLEMENT_PENDING
                      : settlementTab === "Requested"
                        ? EmptyType.SETTLEMENT_REQUESTED
                        : settlementTab === "Settled"
                          ? EmptyType.SETTLEMENT_SETTLED
                          : EmptyType.SETTLEMENT_ALL
                  }
                />
              )}
              ListFooterComponent={() => (
                <>
                  {(settlementTab === "Settled" || settlementTab === "All") &&
                    hasMoreSettled && (
                      <Box className="px-4 pb-2">
                        <FormButton
                          variant="outline"
                          text="Load More"
                          loading={loadingMore}
                          onPress={loadMoreSettled}
                        />
                      </Box>
                    )}
                  <Box className="h-16" />
                </>
              )}
              stickySectionHeadersEnabled={true}
            />
          </LoadingWrapper>
        </VStack>
      </VStack>

      <DateRangeSheet
        isOpen={dateRangeSheetOpen}
        onClose={() => setDateRangeSheetOpen(false)}
        dateRange={dateRange}
        onSelect={setDateRange}
      />
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
          onRefetch={fetchAll}
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
          onRefetch={fetchAll}
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
          onRefetch={fetchAll}
          isPayer={reviewIsPayer}
          readOnly={reviewSheetReadOnly}
        />
      )}
    </Fragment>
  );
}
