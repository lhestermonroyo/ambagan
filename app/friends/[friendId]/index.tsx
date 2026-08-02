import AppAvatar from "@/components/AppAvatar";
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
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from "@/components/ui/modal";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { SectionList } from "@/components/ui/section-list";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import NetBalanceDisplay from "@/features/expense/components/NetBalanceDisplay";
import SettlementActionSheet from "@/features/expense/components/SettlementActionSheet";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import SettlementGroupCard from "@/features/expense/components/SettlementGroupCard";
import SettlementItem from "@/features/expense/components/SettlementItem";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  groupByDate,
  groupByExpenseId
} from "@/features/expense/utils/grouping.util";
import { getSettlementUpdatedAt } from "@/features/expense/utils/settlementDate.util";
import FriendInfoTab from "@/features/friends/components/FriendInfoTab";
import FriendStatsTab from "@/features/friends/components/FriendStatsTab";
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
import { useFavoriteToggle } from "@/features/group/hooks/useFavoriteToggle";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import { useNetwork } from "@/hooks/useNetwork";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { cacheService } from "@/utils/cacheService";
import { groupByCurrency } from "@/utils/currency";
import { BASE_CURRENCY, useConvertedTotal } from "@/utils/fx";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";
import {
  CalendarRange,
  CheckCheck,
  ChevronDown,
  FileCheckCorner,
  Heart,
  LayoutList,
  Search,
  X
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  RefreshControl,
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

export default function FriendDetailScreen() {
  const { friendId, name, email, avatar, tab, settlementId } =
    useLocalSearchParams<{
      friendId: string;
      name: string;
      email: string;
      avatar: string;
      tab?: string;
      // When present, this screen was opened from a settlement notification:
      // auto-open that settlement's sheet and highlight its row.
      settlementId?: string;
    }>();

  const [activeTab, setActiveTab] = useState<"Settlements" | "Stats" | "Info">(
    "Settlements"
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSettlements, setActiveSettlements] = useState<PaymentPreview[]>(
    []
  );
  const [settledSettlements, setSettledSettlements] = useState<
    PaymentPreview[]
  >([]);
  const [settledPage, setSettledPage] = useState(0);
  const [hasMoreSettled, setHasMoreSettled] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentPreview | null>(
    null
  );
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [viewBy, setViewBy] = useState<ViewOption>("By Date");
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [customRange, setCustomRange] = useState<CustomDateRange | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "settle" | "request" | null
  >(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [settlementTab, setSettlementTab] = useState<SettlementStatus>(
    tab === "History" ? "Settled" : "All"
  );
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const initializedRef = useRef(false);
  // Deep-link from a settlement notification: the row to tint, a one-shot guard
  // so the sheet only auto-opens on arrival, and a timer to fade the tint after
  // the sheet is dismissed.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const autoOpenHandledRef = useRef(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { details: userDetails, settlementView } = states.user();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();
  const { isOnline } = useNetwork();

  const { favoriteIds, loadFavorites, handleToggleFavorite } =
    useFavoriteToggle(userDetails?.id);
  const isFavorite = favoriteIds.has(friendId ?? "");

  const decodedName = decodeURIComponent(name || "");
  const decodedEmail = decodeURIComponent(email || "");
  const decodedAvatar = decodeURIComponent(avatar || "");

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id || !friendId) return;
        fetchAll(!initialized);
        loadFavorites();
      },
      [userDetails?.id, friendId, initialized]
    )
  );

  useEffect(() => {
    if (!initializedRef.current) return;
    if (!userDetails?.id || !friendId) return;
    setSettledSettlements([]);
    setSettledPage(0);
    fetchSettled(0, getDateRangeBounds(dateRange, customRange));
  }, [dateRange, customRange]);

  // Deep-link from a settlement notification: once the lists are loaded, open
  // the referenced settlement's sheet and highlight its row. One-shot so it
  // doesn't reopen on refetch/refocus. Falls back to fetching the split by id
  // when it isn't on the loaded pages (e.g. an older settled item).
  useEffect(() => {
    if (autoOpenHandledRef.current) return;
    if (!settlementId || !initialized) return;

    autoOpenHandledRef.current = true;

    const loaded = [...activeSettlements, ...settledSettlements].find(
      (s) => s.id === settlementId
    );

    if (loaded) {
      setSelectedPayment(loaded);
      setHighlightId(loaded.id);
      setActionSheetOpen(true);
      return;
    }

    if (isOnline) {
      const notifyGone = () =>
        toast({
          title: "No longer available",
          description:
            "The settlement linked to this notification no longer exists.",
          type: "info"
        });

      services.expense
        .getPaymentById(settlementId)
        .then((full) => {
          if (!full) {
            notifyGone();
            return;
          }
          setSelectedPayment(full as PaymentPreview);
          setHighlightId(full.id);
          setActionSheetOpen(true);
        })
        .catch((error) => {
          // .single() throws PGRST116 when the row is gone (or RLS-hidden);
          // treat that as "no longer available" rather than a silent failure.
          if (error?.code === "PGRST116") {
            notifyGone();
            return;
          }
          console.error("Failed to open settlement from notification:", error);
        });
    }
  }, [
    settlementId,
    initialized,
    activeSettlements,
    settledSettlements,
    isOnline
  ]);

  // Clear any pending highlight-fade timer on unmount.
  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    []
  );

  // Dismissing the deep-linked sheet leaves the row tinted briefly so the eye
  // can catch it, then fades.
  const handleActionSheetClose = () => {
    setActionSheetOpen(false);
    if (highlightId) {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightId(null), 2500);
    }
  };

  const fetchAll = async (showLoading = true) => {
    if (!userDetails?.id || !friendId) return;
    if (showLoading) setLoading(true);
    try {
      const { start: cutoff, end: until } = getDateRangeBounds(
        dateRange,
        customRange
      );
      const [active, settled] = await Promise.all([
        services.friend.getActiveFriendSettlements(userDetails.id, friendId),
        services.friend.getSettledFriendSettlements(userDetails.id, friendId, {
          cutoff,
          until,
          page: 0
        })
      ]);
      setActiveSettlements(active);
      setSettledSettlements(settled.data);
      setSettledPage(0);
      setHasMoreSettled(settled.hasNext);
      initializedRef.current = true;

      // Cache for offline viewing of this friend's settlements.
      cacheService
        .saveFriendSettlements(friendId, active, settled.data)
        .catch(() => {});
    } catch (error) {
      // Offline / fetch failure — hydrate from the cached snapshot.
      const cached = await cacheService
        .getFriendSettlements(friendId)
        .catch(() => null);
      if (cached) {
        setActiveSettlements(cached.active as PaymentPreview[]);
        setSettledSettlements(cached.settled as PaymentPreview[]);
        setSettledPage(0);
        setHasMoreSettled(false);
        initializedRef.current = true;
      } else {
        console.error("Failed to fetch friend settlements:", error);
      }
    } finally {
      if (showLoading) setLoading(false);
      setInitialized(true);
    }
  };

  const fetchSettled = async (
    page: number,
    bounds: { start: Date | null; end: Date | null }
  ) => {
    if (!userDetails?.id || !friendId) return;
    try {
      const result = await services.friend.getSettledFriendSettlements(
        userDetails.id,
        friendId,
        { cutoff: bounds.start, until: bounds.end, page }
      );
      setSettledSettlements((prev) =>
        page === 0 ? result.data : [...prev, ...result.data]
      );
      setSettledPage(page);
      setHasMoreSettled(result.hasNext);
    } catch (error) {
      console.error("Failed to fetch settled friend settlements:", error);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll(false);
    setRefreshing(false);
  };

  const requireOnline = () => {
    if (!isOnline) {
      toast({
        title: "You're offline",
        description:
          "Settling and requests need a connection. Try again once you're back online.",
        type: "info"
      });
      return false;
    }
    return true;
  };

  const handleConfirmAction = async () => {
    if (!userDetails?.id || !friendId || !pendingAction) return;
    if (
      !(await ensureOnline("Settling balances needs an internet connection."))
    )
      return;
    setActionLoading(true);
    try {
      if (pendingAction === "settle") {
        await services.friend.bulkSettleWithFriend(userDetails.id, friendId);
        toast({
          title: "All settled!",
          description: `All your collections from ${decodedName} have been marked as settled.`,
          type: "success"
        });
      } else {
        await services.friend.bulkRequestSettleWithFriend(
          userDetails.id,
          friendId
        );
        toast({
          title: "Requests sent!",
          description: `All your pending settlements with ${decodedName} have been requested.`,
          type: "success"
        });
      }
      setPendingAction(null);
      await fetchAll(false);
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        type: "error"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const canSettle = useMemo(
    () => activeSettlements.some((s) => s.payer.id === userDetails?.id),
    [activeSettlements, userDetails]
  );

  const canRequestSettle = useMemo(
    () =>
      activeSettlements.some(
        (s) => s.member.id === userDetails?.id && s.status === "pending"
      ),
    [activeSettlements, userDetails]
  );

  const toCollect = useMemo(
    () =>
      groupByCurrency(
        activeSettlements.filter((s) => s.payer.id === userDetails?.id)
      ),
    [activeSettlements, userDetails]
  );

  const toPay = useMemo(
    () =>
      groupByCurrency(
        activeSettlements.filter((s) => s.member.id === userDetails?.id)
      ),
    [activeSettlements, userDetails]
  );

  const netBalance = useMemo(() => {
    const allCurrencies = new Set([
      ...toCollect.map((i) => i.currency),
      ...toPay.map((i) => i.currency)
    ]);
    return Array.from(allCurrencies).map((currency) => {
      const receive =
        toCollect.find((i) => i.currency === currency)?.amount ?? 0;
      const pay = toPay.find((i) => i.currency === currency)?.amount ?? 0;
      return { currency, amount: receive - pay };
    });
  }, [toCollect, toPay]);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Mirrors the hero card it fades in from, so it converts on the same terms —
  // the two are briefly on screen together, and a "Net" that disagreed with the
  // card above it would read as a bug.
  const compactNet = useConvertedTotal(netBalance, BASE_CURRENCY);

  const compactCollect = useConvertedTotal(toCollect, BASE_CURRENCY);
  const compactPay = useConvertedTotal(toPay, BASE_CURRENCY);

  const COMPACT_THRESHOLD = 290;
  const compactOpacity = scrollY.interpolate({
    inputRange: [COMPACT_THRESHOLD - 60, COMPACT_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });
  const compactTranslateY = scrollY.interpolate({
    inputRange: [COMPACT_THRESHOLD - 60, COMPACT_THRESHOLD],
    outputRange: [-16, 0],
    extrapolate: "clamp"
  });

  const filteredSettlements = useMemo(() => {
    const { start: cutoff, end: until } = getDateRangeBounds(
      dateRange,
      customRange
    );

    let filtered: PaymentPreview[];
    if (settlementTab === "Settled") {
      filtered = settledSettlements;
    } else if (settlementTab === "Pending") {
      filtered = activeSettlements
        .filter((s) => s.status === "pending")
        .filter((s) => isWithinRange(s.created_at, cutoff, until));
    } else if (settlementTab === "Requested") {
      filtered = activeSettlements
        .filter((s) => s.status === "requested")
        .filter((s) => isWithinRange(s.created_at, cutoff, until));
    } else {
      const activeFiltered = activeSettlements.filter((s) =>
        isWithinRange(s.created_at, cutoff, until)
      );
      filtered = [...activeFiltered, ...settledSettlements];
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((s) => {
        const description = (s.expense_description ?? "").toLowerCase();
        const payerName =
          `${s.payer.first_name} ${s.payer.last_name}`.toLowerCase();
        const memberName =
          `${s.member.first_name} ${s.member.last_name}`.toLowerCase();
        return (
          description.includes(query) ||
          payerName.includes(query) ||
          memberName.includes(query)
        );
      });
    }

    // Most recently acted-on settlement first, so the item you just
    // requested/settled/rejected surfaces at the top when switching tabs. Also
    // orders the grouped views (groups keep insertion order of their first item).
    return [...filtered].sort(
      (a, b) =>
        new Date(getSettlementUpdatedAt(b)).getTime() -
        new Date(getSettlementUpdatedAt(a)).getTime()
    );
  }, [
    activeSettlements,
    settledSettlements,
    settlementTab,
    dateRange,
    customRange,
    searchQuery
  ]);

  const sections = useMemo(() => {
    if (viewBy === "By Expense") {
      return groupByExpenseId(filteredSettlements);
    }

    if (viewBy === "By Person") {
      const grouped: Record<string, PaymentPreview[]> = {};
      filteredSettlements.forEach((s) => {
        const isUserPayer = s.payer.id === userDetails?.id;
        const key = isUserPayer ? "collect" : "pay";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });
      return [
        grouped["collect"]?.length && {
          title: "To Collect",
          data: grouped["collect"]
        },
        grouped["pay"]?.length && {
          title: "To Pay",
          data: grouped["pay"]
        }
      ].filter(Boolean) as { title: string; data: PaymentPreview[] }[];
    }

    return groupByDate(filteredSettlements, getSettlementUpdatedAt);
  }, [filteredSettlements, viewBy, userDetails]);

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

  const handleItemPress = (item: PaymentPreview) => {
    // Viewing a settlement is allowed offline — the sheet's actions (mark
    // settled / approve / reject / request) guard themselves and toast if the
    // user tries them without a connection.
    setSelectedPayment(item);
    setActionSheetOpen(true);
  };

  const onToggleFavorite = () =>
    handleToggleFavorite({
      id: friendId!,
      first_name: decodedName.split(" ")[0] ?? "",
      last_name: decodedName.split(" ").slice(1).join(" ") ?? "",
      email: decodedEmail,
      avatar: decodedAvatar || null,
      phone: null,
      plan: "free"
    });

  const favoriteTint = isFavorite
    ? getPrimaryHex("text-primary-400", colorScheme)
    : getSecondaryHex("text-secondary-950", colorScheme);
  const favoriteLabel = isFavorite
    ? "Remove from favorites"
    : "Add to favorites";

  return (
    <>
      <InnerLayout
        title="Friend Details"
        onBack={() => router.back()}
        actions={
          loading ? undefined : (
            <Stack.Toolbar.Button
              icon={isFavorite ? "heart.fill" : "heart"}
              tintColor={favoriteTint}
              accessibilityLabel={favoriteLabel}
              onPress={onToggleFavorite}
            />
          )
        }
        androidActions={
          loading ? undefined : (
            <Pressable
              className="pr-1"
              aria-label={favoriteLabel}
              onPress={onToggleFavorite}
            >
              <Heart
                size={24}
                color={favoriteTint}
                fill={isFavorite ? favoriteTint : "transparent"}
              />
            </Pressable>
          )
        }
      >
        <ScrollView
          className="flex-1"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <VStack className="gap-y-6 pt-4">
            <VStack className="px-4 gap-y-6">
              <HStack className="gap-x-3 items-center">
                <AppAvatar
                  name={decodedName}
                  uri={decodedAvatar || undefined}
                  size="lg"
                />
                <VStack>
                  <Text bold className="text-xl">
                    {decodedName}
                  </Text>
                  <Text className="text-secondary-950">{decodedEmail}</Text>
                </VStack>
              </HStack>

              {/* Tabs: Settlements (landing), Stats and Info */}
              <HStack className="gap-x-2">
                {(["Settlements", "Stats", "Info"] as const).map((t) => (
                  <FormButton
                    size="sm"
                    key={t}
                    variant={t === activeTab ? "solid" : "outline"}
                    text={t}
                    onPress={() => setActiveTab(t)}
                  />
                ))}
              </HStack>

              {activeTab === "Settlements" && (
                <VStack className="gap-y-4">
                  <Card className="rounded-xl bg-secondary-100">
                    <VStack className="gap-y-4">
                      {/* Net Balance Hero */}
                      <NetBalanceDisplay
                        isLoading={loading}
                        items={netBalance}
                        currency={BASE_CURRENCY}
                        subtitle="To Collect minus To Pay with this friend, per currency"
                      />

                      <Divider />

                      {/* Stat Columns */}
                      <HStack className="items-stretch">
                        <VStack className="flex-1 gap-y-2">
                          <HStack className="items-center gap-x-2">
                            <SettlementAvatar isPayer={true} size="sm" />
                            <Text className="text-secondary-950 text-sm uppercase">
                              To Collect
                            </Text>
                          </HStack>
                          <CurrencyAmountDisplay
                            isLoading={loading}
                            items={toCollect}
                            label="To Collect"
                            subtitle="Owed to you by this friend, per currency"
                            type="receive"
                            primaryCurrency={BASE_CURRENCY}
                            convertTo={BASE_CURRENCY}
                            totalLabel="Total to collect"
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
                            isLoading={loading}
                            items={toPay}
                            label="To Pay"
                            subtitle="You owe this friend, per currency"
                            type="pay"
                            primaryCurrency={BASE_CURRENCY}
                            convertTo={BASE_CURRENCY}
                            totalLabel="Total to pay"
                          />
                        </VStack>
                      </HStack>
                    </VStack>
                  </Card>

                  <VStack className="gap-y-2">
                    {canSettle && (
                      <FormButton
                        text="Mark All as Settled"
                        icon={
                          <CheckCheck
                            color={getSecondaryHex(
                              "text-secondary-0",
                              colorScheme
                            )}
                          />
                        }
                        onPress={() =>
                          requireOnline() && setPendingAction("settle")
                        }
                      />
                    )}
                    {canRequestSettle && (
                      <FormButton
                        variant="outline"
                        text="Request All as Settled"
                        icon={
                          <FileCheckCorner
                            color={getPrimaryHex(
                              "text-primary-500",
                              colorScheme
                            )}
                          />
                        }
                        onPress={() =>
                          requireOnline() && setPendingAction("request")
                        }
                      />
                    )}
                  </VStack>
                </VStack>
              )}
            </VStack>

            {activeTab === "Stats" && userDetails && friendId && (
              <FriendStatsTab
                userId={userDetails.id}
                friendId={friendId}
                friendName={decodedName}
              />
            )}

            {activeTab === "Info" && friendId && (
              <FriendInfoTab friendId={friendId} email={decodedEmail} />
            )}

            {activeTab === "Settlements" && (
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
                              : getSecondaryHex(
                                  "text-secondary-950",
                                  colorScheme
                                )
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
                              : getSecondaryHex(
                                  "text-secondary-950",
                                  colorScheme
                                )
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
                              : getSecondaryHex(
                                  "text-secondary-950",
                                  colorScheme
                                )
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
                        onPress={() => {
                          setDateRange("All");
                          setCustomRange(null);
                        }}
                        className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                      >
                        <Text className="text-sm text-primary-600">
                          {formatDateRangeLabel(dateRange, customRange)}
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
                        <Text className="text-sm text-primary-600">
                          {viewBy}
                        </Text>
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
                      sections={sections}
                      extraData={settlementView}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <SettlementItem
                          item={item}
                          onPress={handleItemPress}
                          highlighted={item.id === highlightId}
                        />
                      )}
                      renderSectionHeader={({ section: { title } }) => (
                        <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
                          <Text className="text-sm text-secondary-950">
                            {title}
                          </Text>
                        </Box>
                      )}
                      ItemSeparatorComponent={ListDivider}
                      stickySectionHeadersEnabled={true}
                      ListEmptyComponent={() => <EmptyList type={emptyType} />}
                      ListFooterComponent={() =>
                        (settlementTab === "Settled" ||
                          settlementTab === "All") &&
                        hasMoreSettled ? (
                          <ListFooter
                            hasNextPage={hasMoreSettled}
                            loading={loadingMore}
                            onLoadMore={loadMoreSettled}
                          />
                        ) : null
                      }
                    />
                  ) : sections.length === 0 ? (
                    <EmptyList type={emptyType} />
                  ) : (
                    <VStack className="gap-y-3 px-4">
                      {sections.map((section) => (
                        <SettlementGroupCard
                          key={section.data[0].id}
                          title={section.title}
                          items={section.data}
                          highlightId={highlightId}
                          onItemPress={(item) =>
                            handleItemPress(item as PaymentPreview)
                          }
                        />
                      ))}
                      {(settlementTab === "Settled" ||
                        settlementTab === "All") &&
                        hasMoreSettled && (
                          <ListFooter
                            hasNextPage={hasMoreSettled}
                            loading={loadingMore}
                            onLoadMore={loadMoreSettled}
                          />
                        )}
                    </VStack>
                  )}
                </LoadingWrapper>
              </VStack>
            )}
          </VStack>
        </ScrollView>

        {/* Compact sticky stats — Settlements tab only. Pinned just under the
            native header as an absolute overlay that fades in once the friend
            header scrolls away. Like the group Settlements tab, it animates only
            opacity + translateY (never height) and stays non-interactive, so it
            never reflows the list and scroll/touches pass through. */}
        {activeTab === "Settlements" && (
          <Animated.View
            pointerEvents="none"
            className="absolute top-0 left-0 right-0 bg-background-0"
            style={{
              opacity: compactOpacity,
              transform: [{ translateY: compactTranslateY }],
              borderBottomWidth: 1,
              borderBottomColor: "rgba(0,0,0,0.06)"
            }}
          >
            <HStack className="px-6 py-3 gap-x-4 items-center justify-center">
              <VStack className="items-center flex-1">
                <Text
                  className="text-secondary-950 text-sm uppercase tracking-widest"
                  numberOfLines={1}
                >
                  Net
                </Text>
                <Text
                  bold
                  className={`text-lg ${
                    compactNet.total < 0 ? "text-error-400" : ""
                  }`}
                >
                  {compactNet.convertedCurrencies.length > 0 ? "≈ " : ""}
                  {formatAmount(compactNet.total, BASE_CURRENCY)}
                </Text>
              </VStack>
              <Text className="text-secondary-200">|</Text>
              <VStack className="items-center flex-1">
                <Text
                  className="text-secondary-950 text-sm uppercase tracking-widest"
                  numberOfLines={1}
                >
                  Collect
                </Text>
                <Text bold className="text-lg" numberOfLines={1}>
                  {compactCollect.convertedCurrencies.length > 0 ? "≈ " : ""}
                  {formatAmount(compactCollect.total, BASE_CURRENCY)}
                </Text>
              </VStack>
              <Text className="text-secondary-200">|</Text>
              <VStack className="items-center flex-1">
                <Text
                  className="text-secondary-950 text-sm uppercase tracking-widest"
                  numberOfLines={1}
                >
                  Pay
                </Text>
                <Text bold className="text-lg text-error-400" numberOfLines={1}>
                  {compactPay.convertedCurrencies.length > 0 ? "≈ " : ""}
                  {formatAmount(compactPay.total, BASE_CURRENCY)}
                </Text>
              </VStack>
            </HStack>
          </Animated.View>
        )}
      </InnerLayout>

      <SettlementActionSheet
        isOpen={actionSheetOpen}
        onClose={handleActionSheetClose}
        item={selectedPayment}
        onRefetch={() => fetchAll(false)}
      />
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
        customRange={customRange}
        onSelect={(value, custom) => {
          setDateRange(value);
          setCustomRange(custom ?? null);
        }}
      />
      <ViewBySheet
        isOpen={viewSheetOpen}
        onClose={() => setViewSheetOpen(false)}
        viewBy={viewBy}
        onSelect={setViewBy}
      />
      <Modal
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
      >
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Heading>
              {pendingAction === "settle"
                ? "Mark All as Settled"
                : "Request All as Settled"}
            </Heading>
          </ModalHeader>
          <ModalBody>
            <Text>
              {pendingAction === "settle"
                ? `This will mark all your outstanding collections from ${decodedName} as settled. This action cannot be undone.`
                : `This will send a settlement request for all your pending payments to ${decodedName}.`}
            </Text>
          </ModalBody>
          <ModalFooter className="gap-x-2">
            <FormButton
              className="flex-1"
              variant="outline"
              text="Cancel"
              onPress={() => setPendingAction(null)}
            />
            <FormButton
              className="flex-1"
              text={pendingAction === "settle" ? "Settle All" : "Request All"}
              loading={actionLoading}
              onPress={handleConfirmAction}
            />
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
