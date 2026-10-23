import { groupSettlementBalancesByCurrency as groupByCurrency } from "@/features/expense/utils/settlementPayments.util";
import { useEmptyStatePreview } from "@/hooks/useEmptyStatePreview";
import EmptyList, { EmptyListAction } from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import {
  FilterBarSkeleton,
  NetBalanceCardSkeleton,
  SettlementListSkeleton
} from "@/components/SkeletonLoader";
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
import NetBalanceDisplay from "@/features/expense/components/NetBalanceDisplay";
import SettlementActionSheet from "@/features/expense/components/SettlementActionSheet";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import SettlementGroupCard from "@/features/expense/components/SettlementGroupCard";
import SettlementItem from "@/features/expense/components/SettlementItem";
import {
  groupByDate,
  groupByExpenseId
} from "@/features/expense/utils/grouping.util";
import { sortPaymentsByStatus } from "@/features/expense/utils/payment.util";
import { getSettlementUpdatedAt } from "@/features/expense/utils/settlementDate.util";
import DateRangeSheet, {
  CustomDateRange,
  DateRangeOption,
  formatDateRangeLabel,
  getDateRangeBounds,
  isWithinRange
} from "@/features/group/components/DateRangeSheet";
import StatusSheet, {
  SettlementStatus
} from "@/features/group/components/StatusSheet";
import ViewBySheet, {
  ViewOption
} from "@/features/group/components/ViewBySheet";
import services from "@/services";
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { cacheService } from "@/utils/cacheService";
import { BASE_CURRENCY } from "@/utils/fx";
import {
  getPrimaryHex,
  getSecondaryHex,
  getOnOutlineHex
} from "@/utils/getColorHex";
import { useFocusEffect } from "expo-router";
import {
  CalendarRange,
  ChevronDown,
  LayoutList,
  Search,
  X
} from "lucide-react-native";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createRefreshGate, dataRevision } from "@/utils/dataRefresh";
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
  refreshTrigger = 0,
  emptyActions,
  groupId: requestedGroupId,
  currency,
  groupLoading = false,
  onLoadingChange
}: {
  refreshTrigger?: number;
  emptyActions: EmptyListAction[];
  /** Start loading with the route ID, before the full group record arrives. */
  groupId?: string;
  currency?: string;
  groupLoading?: boolean;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const previewEmpty = useEmptyStatePreview();
  const { details, settlementRefreshToken } = states.group();
  const { details: userDetails, settlementView } = states.user();

  // These cards are scoped to one group, so they lead with that group's own
  // currency — the same one the compact sticky bar on the detail screen folds
  // into, which is what keeps the two figures agreeing.
  const groupId = requestedGroupId ?? details?.id;
  const primaryCurrency =
    currency ??
    (details?.id === groupId ? details?.currency : undefined) ??
    BASE_CURRENCY;
  const colorScheme = useColorScheme() ?? "light";

  const [loading, setLoading] = useState(true);
  const contentLoading = loading || groupLoading;
  const [loadingMore, setLoadingMore] = useState(false);
  const [activePayments, setActivePayments] = useState<Payment[]>([]);
  const [settledPayments, setSettledPayments] = useState<Payment[]>([]);
  const [settledPage, setSettledPage] = useState(0);
  const [hasMoreSettled, setHasMoreSettled] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [settlementSheetOpen, setSettlementSheetOpen] = useState(false);
  const [settlementTab, setSettlementTab] = useState<SettlementStatus>("All");
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [viewBy, setViewBy] = useState<ViewOption>("By Date");
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [customRange, setCustomRange] = useState<CustomDateRange | null>(null);
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const actions: EmptyListAction[] =
    searchQuery || dateRange !== "All" || settlementTab !== "All"
      ? [
          {
            label: "View All",
            icon: LayoutList,
            onPress: () => {
              setSearchQuery("");
              setSearchOpen(false);
              setDateRange("All");
              setCustomRange(null);
              setSettlementTab("All");
            }
          }
        ]
      : emptyActions;
  const initializedRef = useRef(false);
  const refreshGate = useRef(createRefreshGate()).current;
  const settledRequestRef = useRef(0);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useFocusEffect(
    useMemo(
      () => () => {
        if (groupId && userDetails?.id) {
          fetchAll(false);
        }
      },
      [groupId, userDetails?.id, settlementRefreshToken, dateRange, customRange]
    )
  );

  useEffect(() => {
    if (refreshTrigger > 0 && groupId && userDetails?.id) {
      fetchAll(true);
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (settlementRefreshToken > 0 && groupId && userDetails?.id) {
      fetchAll(false);
    }
  }, [settlementRefreshToken]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (!groupId || !userDetails?.id) return;
    setSettledPayments([]);
    setSettledPage(0);
    fetchSettled(0, getDateRangeBounds(dateRange, customRange));
  }, [dateRange, customRange]);

  const fetchAll = (force = false) => {
    if (!groupId || !userDetails?.id) return Promise.resolve();
    return refreshGate.run(
      `${userDetails.id}:${groupId}`,
      `${dataRevision("settlements")}:${settlementRefreshToken ?? 0}`,
      loadAll,
      force
    ).catch((error) => console.error("Error fetching group payments:", error));
  };

  const loadAll = async () => {
    if (!groupId || !userDetails?.id) return;
    const historyRequest = ++settledRequestRef.current;
    // Keep the current content and controls in place during action refreshes.
    if (!initializedRef.current) setLoading(true);
    try {
      const { start: cutoff, end: until } = getDateRangeBounds(
        dateRange,
        customRange
      );
      const [active, settled] = await Promise.all([
        services.expense.getActivePaymentsByGroupAndUserId(
          groupId,
          userDetails.id
        ),
        services.expense.getSettledPaymentsByGroupAndUserId(
          groupId,
          userDetails.id,
          { cutoff, until, page: 0 }
        )
      ]);
      setActivePayments(sortPaymentsByStatus(active));
      if (historyRequest === settledRequestRef.current) {
        setSettledPayments(settled.data);
        setSettledPage(0);
        setHasMoreSettled(settled.hasNext);
      }
      states.group.setState((prev) => ({
        ...prev,
        settlementList: sortPaymentsByStatus([...active, ...settled.data])
      }));
      initializedRef.current = true;

      // Cache for offline viewing of the Settlements tab.
      cacheService
        .saveGroupSettlements(groupId, active, settled.data)
        .catch(() => {});
    } catch (error) {
      // Offline / fetch failure — hydrate from the cached snapshot.
      const cached = await cacheService
        .getGroupSettlements(groupId)
        .catch(() => null);

      if (cached) {
        const cachedActive = cached.active as Payment[];
        const cachedSettled = cached.settled as Payment[];
        setActivePayments(sortPaymentsByStatus(cachedActive));
        if (historyRequest === settledRequestRef.current) {
          setSettledPayments(cachedSettled);
          setSettledPage(0);
          setHasMoreSettled(false);
        }
        states.group.setState((prev) => ({
          ...prev,
          settlementList: sortPaymentsByStatus([
            ...cachedActive,
            ...cachedSettled
          ])
        }));
        initializedRef.current = true;
      }
      // Keep the revision dirty so a failed action refresh can be retried.
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchSettled = async (
    page: number,
    bounds: { start: Date | null; end: Date | null }
  ) => {
    if (!groupId || !userDetails?.id) return;
    const request = ++settledRequestRef.current;
    try {
      const result = await services.expense.getSettledPaymentsByGroupAndUserId(
        groupId,
        userDetails.id,
        { cutoff: bounds.start, until: bounds.end, page }
      );
      if (request !== settledRequestRef.current) return;
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
      await fetchSettled(
        settledPage + 1,
        getDateRangeBounds(dateRange, customRange)
      );
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
    const { start: cutoff, end: until } = getDateRangeBounds(
      dateRange,
      customRange
    );

    let filtered: Payment[];
    if (settlementTab === "Settled") {
      filtered = settledPayments;
    } else if (settlementTab === "Pending") {
      filtered = activePayments
        .filter((p) => p.status === "pending")
        .filter((p) => isWithinRange(p.created_at, cutoff, until));
    } else if (settlementTab === "Partially Paid") {
      // A later request can be awaiting confirmation while a confirmed
      // partial payment has already reduced this settlement's balance.
      filtered = activePayments
        .filter((p) =>
          p.status !== "settled" &&
          (p.confirmed_paid_amount ?? 0) > 0 &&
          (p.confirmed_paid_amount ?? 0) < p.amount
        )
        .filter((p) => isWithinRange(p.created_at, cutoff, until));
    } else if (settlementTab === "Requested") {
      filtered = activePayments
        .filter((p) => p.status === "requested")
        .filter((p) => isWithinRange(p.created_at, cutoff, until));
    } else {
      const activeFiltered = activePayments.filter((p) =>
        isWithinRange(p.created_at, cutoff, until)
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
    customRange,
    searchQuery
  ]);

  const handleSettlementItemPress = (
    payment: PaymentPreview | Payment
  ) => {
    if (payment.member.id !== userDetails?.id && payment.payer.id !== userDetails?.id) return;
    // Present immediately. The screen reads fresh details and history together.
    setSelectedPayment(payment as Payment);
    setSettlementSheetOpen(true);
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
  const emptyContent = searchQuery || dateRange !== "All"
    ? "No payments match these filters."
    : settlementTab === "Partially Paid"
      ? "No partially paid settlements. They appear here after a partial payment is confirmed."
      : undefined;

  return (
    <Fragment>
      <VStack className="gap-y-6">
        <VStack className="px-4">
          {contentLoading ? (
            <NetBalanceCardSkeleton />
          ) : (
            <Card className="rounded-xl bg-secondary-100">
              <VStack className="gap-y-4">
                <NetBalanceDisplay
                  items={netBalance}
                  currency={primaryCurrency}
                  subtitle="To Collect minus To Pay in this group, per currency"
                />

                <Divider />

                <HStack className="items-stretch">
                  <VStack className="flex-1 gap-y-2">
                    <HStack className="items-center gap-x-2">
                      <SettlementAvatar isPayer={true} size="sm" />
                      <Text className="text-secondary-950 text-sm uppercase">
                        To Collect
                      </Text>
                    </HStack>
                    <CurrencyAmountDisplay
                      items={yourToCollectTotalByCurrency}
                      label="To Collect"
                      subtitle="Owed to you in this group, per currency"
                      type="receive"
                      primaryCurrency={primaryCurrency}
                      convertTo={primaryCurrency}
                      totalLabel="Total to Collect"
                    />
                  </VStack>
                  <Divider orientation="vertical" className="mx-4" />
                  <VStack className="flex-1 gap-y-2">
                    <HStack className="items-center gap-x-2">
                      <SettlementAvatar isPayer={false} size="sm" />
                      <Text className="text-secondary-950 text-sm uppercase">
                        To Pay
                      </Text>
                    </HStack>
                    <CurrencyAmountDisplay
                      items={yourTotalUnpaidByCurrency}
                      label="To Pay"
                      subtitle="You owe in this group, per currency"
                      type="pay"
                      primaryCurrency={primaryCurrency}
                      convertTo={primaryCurrency}
                      totalLabel="Total to Pay"
                    />
                  </VStack>
                </HStack>
              </VStack>
            </Card>
          )}
        </VStack>

        <VStack className="gap-y-4">
          <LoadingWrapper
            isLoading={contentLoading}
            skeleton={
              <VStack className="gap-y-4">
                <FilterBarSkeleton actions search={searchOpen} />
                <SettlementListSkeleton
                  view={settlementView}
                  showProgress={settlementTab === "Partially Paid"}
                />
              </VStack>
            }
          >
            {searchOpen ? (
              <HStack className="px-4 items-center gap-x-2">
                <Box className="flex-1">
                  <SearchInput
                    autoFocus
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by description or name"
                  />
                </Box>
                <FormButton
                  size="md"
                  variant="link"
                  text="Cancel"
                  onPress={toggleSearch}
                />
              </HStack>
            ) : (
              <HStack className="px-4 items-center justify-between">
                <FormButton
                  size="sm"
                  variant="outline"
                  text={settlementTab}
                  iconEnd={
                    <ChevronDown
                      size={16}
                      color={getOnOutlineHex(colorScheme)}
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
                      className="text-sm text-primary-600 max-w-[160px] dark:text-primary-800"
                      numberOfLines={1}
                    >
                      &ldquo;{searchQuery}&rdquo;
                    </Text>
                    <X
                      size={12}
                      color={getPrimaryHex(
                        colorScheme === "dark"
                          ? "text-primary-800"
                          : "text-primary-600",
                        colorScheme
                      )}
                    />
                  </Pressable>
                )}
                {dateRange !== "All" && (
                  <Pressable
                    onPress={() => {
                      setDateRange("All");
                      setCustomRange(null);
                    }}
                    className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                  >
                    <Text className="text-sm text-primary-600 dark:text-primary-800">
                      {formatDateRangeLabel(dateRange, customRange)}
                    </Text>
                    <X
                      size={12}
                      color={getPrimaryHex(
                        colorScheme === "dark"
                          ? "text-primary-800"
                          : "text-primary-600",
                        colorScheme
                      )}
                    />
                  </Pressable>
                )}
                {viewBy !== "By Date" && (
                  <Pressable
                    onPress={() => setViewBy("By Date")}
                    className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                  >
                    <Text className="text-sm text-primary-600 dark:text-primary-800">
                      {viewBy}
                    </Text>
                    <X
                      size={12}
                      color={getPrimaryHex(
                        colorScheme === "dark"
                          ? "text-primary-800"
                          : "text-primary-600",
                        colorScheme
                      )}
                    />
                  </Pressable>
                )}
              </HStack>
            )}

            {viewBy === "By Date" ? (
              <SectionList
                scrollEnabled={false}
                sections={previewEmpty ? [] : settlementSections}
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
                ListEmptyComponent={() => (
                  <EmptyList
                    type={emptyType}
                    content={emptyContent}
                    actions={actions}
                  />
                )}
                ListFooterComponent={
                  previewEmpty
                    ? null
                    : () => (
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
                      )
                }
                stickySectionHeadersEnabled={true}
              />
            ) : previewEmpty || settlementSections.length === 0 ? (
              <EmptyList
                type={emptyType}
                content={emptyContent}
                actions={actions}
              />
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
        showPartiallyPaid
        isOpen={statusSheetOpen && !contentLoading}
        onClose={() => setStatusSheetOpen(false)}
        status={settlementTab}
        onSelect={setSettlementTab}
      />
      <DateRangeSheet
        isOpen={dateRangeSheetOpen && !contentLoading}
        onClose={() => setDateRangeSheetOpen(false)}
        dateRange={dateRange}
        customRange={customRange}
        onSelect={(value, custom) => {
          setDateRange(value);
          setCustomRange(custom ?? null);
        }}
      />
      <ViewBySheet
        isOpen={viewSheetOpen && !contentLoading}
        onClose={() => setViewSheetOpen(false)}
        viewBy={viewBy}
        onSelect={setViewBy}
      />

      <SettlementActionSheet
        isOpen={settlementSheetOpen}
        onClose={() => {
          setSettlementSheetOpen(false);
          setSelectedPayment(null);
        }}
        item={selectedPayment}
        onRefetch={() => fetchAll(true)}
        showGroupLink={false}
      />
    </Fragment>
  );
}
