import CurrencyCountButton from "@/components/CurrencyCountButton";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import { SettlementListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { SectionList } from "@/components/ui/section-list";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import MarkAsSettledSheet from "@/features/expense/components/MarkAsSettledSheet";
import RequestSettledSheet from "@/features/expense/components/RequestSettledSheet";
import ReviewRequestPaidSheet from "@/features/expense/components/ReviewRequestPaidSheet";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import SettlementGroupCard from "@/features/expense/components/SettlementGroupCard";
import SettlementItem from "@/features/expense/components/SettlementItem";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  groupByDate,
  groupByExpenseId
} from "@/features/expense/utils/grouping.util";
import { sortPaymentsByStatus } from "@/features/expense/utils/payment.util";
import { getSettlementUpdatedAt } from "@/features/expense/utils/settlementDate.util";
import DateRangeSheet, {
  DateRangeOption,
  dateRangeLabels,
  getDateRangeCutoff
} from "@/features/group/components/DateRangeSheet";
import StatusSheet, {
  SettlementStatus
} from "@/features/group/components/StatusSheet";
import ViewBySheet, {
  ViewOption
} from "@/features/group/components/ViewBySheet";
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import services from "@/services";
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { cacheService } from "@/utils/cacheService";
import { groupByCurrency } from "@/utils/currency";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useFocusEffect } from "expo-router";
import {
  CalendarRange,
  ChevronDown,
  LayoutList,
  Search,
  X
} from "lucide-react-native";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  UIManager,
  useColorScheme
} from "react-native";

// LayoutAnimation needs to be opted into on old-architecture Android; it's a
// no-op elsewhere. Guards the row swap when opening/closing search.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function GroupSettlements({
  refreshTrigger = 0
}: {
  refreshTrigger?: number;
}) {
  const { details, settlementRefreshToken } = states.group();
  const { details: userDetails, defaultCurrency, settlementView } =
    states.user();
  const colorScheme = useColorScheme() ?? "light";
  const toast = useAppToast();
  const { isOnline } = useNetwork();

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
  const [settlementTab, setSettlementTab] = useState<SettlementStatus>("All");
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [viewBy, setViewBy] = useState<ViewOption>("By Date");
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
    if (settlementRefreshToken > 0 && details?.id && userDetails?.id) {
      fetchAll();
    }
  }, [settlementRefreshToken]);

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
        services.expense.getActivePaymentsByGroupAndUserId(
          details.id,
          userDetails.id
        ),
        services.expense.getSettledPaymentsByGroupAndUserId(
          details.id,
          userDetails.id,
          { cutoff, page: 0 }
        )
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

      // Cache for offline viewing of the Settlements tab.
      cacheService
        .saveGroupSettlements(details.id, active, settled.data)
        .catch(() => {});
    } catch (error) {
      // Offline / fetch failure — hydrate from the cached snapshot.
      const cached = await cacheService
        .getGroupSettlements(details.id)
        .catch(() => null);

      if (cached) {
        const cachedActive = cached.active as Payment[];
        const cachedSettled = cached.settled as Payment[];
        setActivePayments(sortPaymentsByStatus(cachedActive));
        setSettledPayments(cachedSettled);
        setSettledPage(0);
        setHasMoreSettled(false);
        states.group.setState((prev) => ({
          ...prev,
          settlementList: sortPaymentsByStatus([
            ...cachedActive,
            ...cachedSettled
          ])
        }));
        initializedRef.current = true;
      } else {
        console.error("Error fetching group payments:", error);
      }
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
      setSettledPayments((prev) =>
        page === 0 ? result.data : [...prev, ...result.data]
      );
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

  const yourTotalUnpaidByCurrency = useMemo(() => {
    if (!userDetails) return [];
    return groupByCurrency(
      activePayments.filter((p) => p.member.id === userDetails.id)
    );
  }, [activePayments, userDetails]);

  const yourToCollectTotalByCurrency = useMemo(() => {
    if (!userDetails) return [];
    return groupByCurrency(
      activePayments.filter((p) => p.payer.id === userDetails.id)
    );
  }, [activePayments, userDetails]);

  const netBalance = useMemo(() => {
    const allCurrencies = new Set([
      ...yourToCollectTotalByCurrency.map((i) => i.currency),
      ...yourTotalUnpaidByCurrency.map((i) => i.currency)
    ]);
    return Array.from(allCurrencies).map((currency) => {
      const receive =
        yourToCollectTotalByCurrency.find((i) => i.currency === currency)
          ?.amount ?? 0;
      const pay =
        yourTotalUnpaidByCurrency.find((i) => i.currency === currency)
          ?.amount ?? 0;
      return { currency, amount: receive - pay };
    });
  }, [yourToCollectTotalByCurrency, yourTotalUnpaidByCurrency]);

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

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((p) => {
        const description = (p.expense_description ?? "").toLowerCase();
        const payerName =
          `${p.payer.first_name} ${p.payer.last_name}`.toLowerCase();
        const memberName =
          `${p.member.first_name} ${p.member.last_name}`.toLowerCase();
        return (
          description.includes(query) ||
          payerName.includes(query) ||
          memberName.includes(query)
        );
      });
    }

    // Surface the most recently acted-on settlement first so that, after a
    // request/settle/reject, switching tabs lands the item you just touched at
    // the top. Ordering by the effective lifecycle date also flows into the
    // grouped views below (groups keep insertion order of their first item).
    filtered = [...filtered].sort(
      (a, b) =>
        new Date(getSettlementUpdatedAt(b)).getTime() -
        new Date(getSettlementUpdatedAt(a)).getTime()
    );

    if (viewBy === "By Expense") {
      return groupByExpenseId(filtered);
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

    return groupByDate(filtered, getSettlementUpdatedAt);
  }, [
    activePayments,
    settledPayments,
    settlementTab,
    viewBy,
    userDetails,
    dateRange,
    searchQuery
  ]);

  const handleSettlementItemPress = async (
    payment: PaymentPreview | Payment
  ) => {
    let p = payment as Payment;

    // Settling / requesting needs the server — block while offline (and for
    // not-yet-synced offline settlements).
    if (!isOnline || p.pending) {
      toast({
        title: "You're offline",
        description:
          "Settling and requests need a connection. Try again once you're back online.",
        type: "info"
      });
      return;
    }

    // A PaymentPreview omits proof_of_payment / notes, which the settlement
    // sheets display. Hydrate it into a full Payment so those aren't empty.
    if (p.proof_of_payment === undefined) {
      try {
        const full = await services.expense.getPaymentById(p.id);
        if (full) {
          p = full;
        }
      } catch (error) {
        console.error("Error fetching payment details:", error);
      }
    }

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

  // Swap the status/filter row for the full-width search field (and back).
  // The query is kept when collapsing so it persists as a chip, mirroring how
  // the date-range and group-by filters behave after their sheets close.
  const toggleSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchOpen((prev) => !prev);
  };

  const emptyType = searchQuery
    ? EmptyType.SEARCH
    : settlementTab === "Pending"
      ? EmptyType.SETTLEMENT_PENDING
      : settlementTab === "Requested"
        ? EmptyType.SETTLEMENT_REQUESTED
        : settlementTab === "Settled"
          ? EmptyType.SETTLEMENT_SETTLED
          : EmptyType.SETTLEMENT_ALL;

  return (
    <Fragment>
      <VStack className="gap-y-6">
        <VStack className="px-4">
          <Card className="rounded-xl bg-secondary-100">
            <VStack className="gap-y-4">
              <NetBalanceHero
                isLoading={loading}
                items={netBalance}
                primaryCurrency={defaultCurrency}
              />

              <Divider />

              <HStack className="items-stretch">
                <VStack className="flex-1 gap-y-2">
                  <HStack className="items-center gap-x-2">
                    <SettlementAvatar isPayer={true} />
                    <Text className="text-secondary-950">To Collect</Text>
                  </HStack>
                  <CurrencyAmountDisplay
                    isLoading={loading}
                    items={yourToCollectTotalByCurrency}
                    label="To Collect"
                    type="receive"
                    primaryCurrency={defaultCurrency}
                  />
                </VStack>
                <Divider orientation="vertical" className="mx-4" />
                <VStack className="flex-1 gap-y-2">
                  <HStack className="items-center gap-x-2">
                    <SettlementAvatar isPayer={false} />
                    <Text className="text-secondary-950">To Pay</Text>
                  </HStack>
                  <CurrencyAmountDisplay
                    isLoading={loading}
                    items={yourTotalUnpaidByCurrency}
                    label="To Pay"
                    type="pay"
                    primaryCurrency={defaultCurrency}
                  />
                </VStack>
              </HStack>
            </VStack>
          </Card>
        </VStack>

        <VStack className="gap-y-4">
          {searchOpen ? (
            <Box className="px-4">
              <SearchInput
                autoFocus
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by description or name"
                rightIcon={X}
                onPressRightIcon={toggleSearch}
              />
            </Box>
          ) : (
            <HStack className="px-4 items-center justify-between">
              <FormButton
                size="sm"
                variant="outline"
                text={settlementTab}
                iconEnd={
                  <ChevronDown
                    size={16}
                    color={getPrimaryHex("text-primary-500", colorScheme)}
                  />
                }
                onPress={() => setStatusSheetOpen(true)}
              />
              <HStack className="gap-x-6 items-center">
                <Button
                  variant="link"
                  className="rounded-full"
                  onPress={toggleSearch}
                >
                  <Search
                    color={
                      searchQuery
                        ? getPrimaryHex("text-primary-400", colorScheme)
                        : getSecondaryHex("text-secondary-950", colorScheme)
                    }
                  />
                </Button>
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
          )}

          {(dateRange !== "All" ||
            viewBy !== "By Date" ||
            (!!searchQuery && !searchOpen)) && (
            <HStack className="gap-x-2 px-4 flex-wrap">
              {!!searchQuery && !searchOpen && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                >
                  <Text
                    className="text-sm text-primary-600 max-w-[160px]"
                    numberOfLines={1}
                  >
                    &ldquo;{searchQuery}&rdquo;
                  </Text>
                  <X
                    size={12}
                    color={getPrimaryHex("text-primary-600", colorScheme)}
                  />
                </Pressable>
              )}
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

          <LoadingWrapper
            isLoading={loading}
            skeleton={<SettlementListSkeleton />}
          >
            {viewBy === "By Date" ? (
              <SectionList
                scrollEnabled={false}
                sections={settlementSections}
                extraData={settlementView}
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
                ItemSeparatorComponent={ListDivider}
                ListEmptyComponent={() => <EmptyList type={emptyType} />}
                ListFooterComponent={() => (
                  <>
                    {(settlementTab === "Settled" ||
                      settlementTab === "All") &&
                      hasMoreSettled && (
                        <ListFooter
                          hasNextPage={hasMoreSettled}
                          loading={loadingMore}
                          onLoadMore={loadMoreSettled}
                        />
                      )}
                    <Box className="h-16" />
                  </>
                )}
                stickySectionHeadersEnabled={true}
              />
            ) : settlementSections.length === 0 ? (
              <EmptyList type={emptyType} />
            ) : (
              <VStack className="gap-y-3 px-4">
                {settlementSections.map((section) => (
                  <SettlementGroupCard
                    key={section.data[0].id.toString()}
                    title={section.title}
                    items={section.data}
                    onItemPress={handleSettlementItemPress}
                  />
                ))}
                {(settlementTab === "Settled" || settlementTab === "All") &&
                  hasMoreSettled && (
                    <ListFooter
                      hasNextPage={hasMoreSettled}
                      loading={loadingMore}
                      onLoadMore={loadMoreSettled}
                    />
                  )}
                <Box className="h-16" />
              </VStack>
            )}
          </LoadingWrapper>
        </VStack>
      </VStack>

      <StatusSheet
        isOpen={statusSheetOpen}
        onClose={() => setStatusSheetOpen(false)}
        status={settlementTab}
        onSelect={setSettlementTab}
      />
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
          showGroupLink={false}
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
          showGroupLink={false}
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
          showGroupLink={false}
        />
      )}
    </Fragment>
  );
}

function NetBalanceHero({
  items,
  isLoading,
  primaryCurrency = "PHP"
}: {
  items: { currency: string; amount: number }[];
  isLoading: boolean;
  primaryCurrency?: string;
}) {
  const sorted = [...items].sort((a, b) =>
    a.currency === primaryCurrency ? -1 : b.currency === primaryCurrency ? 1 : 0
  );
  const [primary] = sorted;
  const primaryAmount = primary?.amount ?? 0;
  const amountColor = primaryAmount < 0 && "text-error-400";

  return (
    <VStack className="gap-y-2">
      <Text bold className="text-sm text-secondary-950 uppercase">
        Net Balance
      </Text>
      {isLoading ? (
        <Text bold className="text-3xl">
          —
        </Text>
      ) : (
        <HStack className="items-end gap-x-2">
          <Text bold className={cn("text-3xl", amountColor)}>
            {formatAmount(primaryAmount, primary?.currency ?? primaryCurrency)}
          </Text>
          <HStack className="items-center gap-x-1 pb-1">
            <Text className="text-secondary-950 text-base">
              {primary?.currency ?? primaryCurrency}
            </Text>
            <CurrencyCountButton
              items={sorted}
              title="Net Balance"
              subtitle="To Collect minus To Pay, per currency"
            />
          </HStack>
        </HStack>
      )}
    </VStack>
  );
}
