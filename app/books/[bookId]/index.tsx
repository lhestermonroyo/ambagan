import useBookStore from "@/features/book/states/book.state";
import { useEmptyStatePreview } from "@/hooks/useEmptyStatePreview";
import ConfirmationSheet from "@/components/ConfirmationSheet";
import AndroidHeaderMenu, {
  type AndroidHeaderMenuItem
} from "@/components/AndroidHeaderMenu";
import AppAvatar from "@/components/AppAvatar";
import CurrencyCountButton from "@/components/CurrencyCountButton";
import HeroAmount from "@/components/HeroAmount";
import EmptyList from "@/components/EmptyList";
import { useExpenseEmptyActions } from "@/features/expense/hooks/useExpenseEmptyActions";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import ProBadge from "@/components/ProBadge";
import SearchInput from "@/components/SearchInput";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import UpgradeSheet from "@/components/UpgradeSheet";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Fab } from "@/components/ui/fab";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import BookInfoTab from "@/features/book/components/BookInfoTab";
import BookStatsTab from "@/features/book/components/BookStatsTab";
import PersonalExpenseItem from "@/features/book/components/PersonalExpenseItem";
import PersonalStatusFilterSheet, {
  PersonalStatusFilter,
  personalStatusFilterLabel
} from "@/features/book/components/PersonalStatusFilterSheet";
import CategorySheet, {
  ALL_CATEGORIES,
  categoryFilterLabel,
  categoryFilterOptions
} from "@/features/expense/components/CategorySheet";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import { amountTextSize } from "@/features/expense/utils/amountTextSize";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import DateRangeSheet, {
  CustomDateRange,
  DateRangeOption,
  formatDateRangeLabel,
  getDateRangeBounds,
  isWithinRange
} from "@/features/group/components/DateRangeSheet";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { Book, PersonalBookTotal, PersonalExpense } from "@/types/books";
import { EmptyType } from "@/types/general";
import { cacheService } from "@/utils/cacheService";
import { formatLastUpdate, getDateGroupTitle } from "@/utils/formatDate";
import { useConvertedTotal } from "@/utils/fx";
import {
  getPrimaryHex,
  getSecondaryHex,
  getOnSolidHex,
  getOnOutlineHex
} from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import { format, parseISO } from "date-fns";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";
import {
  Archive,
  ArchiveRestore,
  CalendarRange,
  ChevronDown,
  CircleCheck,
  Clock,
  ListPlus,
  Pencil,
  Plus,
  Repeat,
  ScanLine,
  Search,
  Tag,
  Trash2,
  X,
  FilterX
} from "lucide-react-native";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  RefreshControl,
  Modal as RNModal,
  SectionList,
  UIManager,
  useColorScheme
} from "react-native";

// LayoutAnimation needs to be opted into on old-architecture Android; it's a
// no-op elsewhere. Guards the row swap when opening/closing expense search.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const tabs = ["Expenses", "Stats", "Info"] as const;

// Move `amount` of `currency` between the paid/pending buckets of a
// PersonalBookTotal[] — the optimistic math behind flipping an expense's status.
// The combined per-currency total is unchanged; only the split moves.
const moveTotalsBucket = (
  totals: PersonalBookTotal[],
  currency: string,
  amount: number,
  from: "paid" | "pending",
  to: "paid" | "pending"
): PersonalBookTotal[] => {
  if (from === to) return totals;
  let found = false;
  const next = totals.map((t) => {
    if (t.currency !== currency) return t;
    found = true;
    return { ...t, [from]: t[from] - amount, [to]: t[to] + amount };
  });
  if (!found) next.push({ currency, paid: 0, pending: 0, [to]: amount });
  return next;
};

export default function BookDetailScreen() {
  const previewEmpty = useEmptyStatePreview();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const expenseEmptyActions = useExpenseEmptyActions({ bookId });
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();
  const colorScheme = useColorScheme() ?? "light";

  const { details: userDetails } = states.user();
  const { list: cachedBooks } = useBookStore();
  const isPro = userDetails?.plan === "pro";

  const [book, setBook] = useState<Book | null>(
    cachedBooks.find((b) => b.id === bookId) ?? null
  );
  const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
  const [totals, setTotals] = useState<PersonalBookTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Expenses");
  // Expense ids whose paid/pending toggle is in flight — dims the pill and
  // guards against a double-tap re-entering the handler mid-request.
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  // Drives the Expenses-tab "Recurring expenses" entry card's subtitle. The list
  // itself lives on the standalone /recurring route; here we only need the active
  // count. Best-effort — recurring reads aren't cached, so offline it stays 0.
  const [activeRecurringCount, setActiveRecurringCount] = useState(0);

  // Expenses tab filters, mirroring the group detail Expenses tab: a pill that
  // opens a bottom sheet, plus search + date-range icon buttons that collapse
  // into removable chips. Search matches the description; the range clamps on
  // expense_date (the field the rows show and the list is ordered by). The pill
  // filters by category — the group's payer filter has no meaning here, since a
  // personal book only ever has one payer.
  const [expenseSearch, setExpenseSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PersonalStatusFilter>("all");
  const [statusFilterSheetOpen, setStatusFilterSheetOpen] = useState(false);
  const [expenseDateRange, setExpenseDateRange] =
    useState<DateRangeOption>("All");
  const [expenseCustomRange, setExpenseCustomRange] =
    useState<CustomDateRange | null>(null);
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);

  // The list is paginated, so filtering `expenses` alone would hide matches
  // sitting on a page that hasn't been loaded yet. The first time a filter is
  // switched on we pull the book's whole ledger and filter that instead.
  const [allExpenses, setAllExpenses] = useState<PersonalExpense[] | null>(
    null
  );
  const fetchedAllRef = useRef(false);

  // Drives the compact sticky stats bar's fade-in, mirroring group details.
  const scrollY = useRef(new Animated.Value(0)).current;

  const hasActiveFilters =
    expenseSearch.trim().length > 0 ||
    categoryFilter !== ALL_CATEGORIES ||
    expenseDateRange !== "All" ||
    statusFilter !== "all";

  const fetchAllExpenses = useCallback(async () => {
    if (!bookId) return;
    fetchedAllRef.current = true;
    try {
      setAllExpenses(
        await services.bookExpense.getAllPersonalExpensesByBookId(bookId)
      );
    } catch (error) {
      // Leave the paginated pages as the fallback source.
      console.error("Failed to load all Individual entry expenses:", error);
    }
  }, [bookId]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!bookId) return;
      if (!isRefresh) setLoading(true);
      try {
        const [bookRes, expensesRes, totalsRes] =
          await Promise.all([
            services.book.getBookById(bookId),
            services.bookExpense.getPersonalExpensesByBookId(bookId, 0),
            services.bookExpense.getPersonalBookTotals(bookId)
          ]);
        setBook(bookRes);
        setExpenses(expensesRes.data);
        setHasMore(expensesRes.hasNext);
        setPage(0);
        setTotals(totalsRes);
        states.book.setState((prev) => ({
          ...prev,
          details: bookRes,
          expenseList: expensesRes.data
        }));
        // Snapshot for offline viewing + optimistic offline mutations.
        cacheService
          .saveBookDetail(bookId, bookRes, expensesRes.data, totalsRes)
          .catch(() => {});
        // Keep the filtered source in step with the page-1 refetch.
        if (fetchedAllRef.current) fetchAllExpenses();
      } catch (error) {
        // Offline / fetch failure — serve the cached snapshot.
        const cached = await cacheService.getBookDetail(bookId);
        if (cached) {
          setBook(cached.book);
          setExpenses(cached.expenseList);
          setTotals(cached.totals);
          setHasMore(false);
          states.book.setState((prev) => ({
            ...prev,
            details: cached.book,
            expenseList: cached.expenseList
          }));
        } else {
          console.error("Failed to load Individual entry:", error);
        }
      } finally {
        setLoading(false);
      }
    },
    [bookId, fetchAllExpenses]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Keep the Expenses tab's recurring entry-card count fresh on focus (e.g. after
  // creating a series from the Add Expense screen and navigating back).
  useFocusEffect(
    useCallback(() => {
      if (!bookId) return;
      services.bookRecurring
        .getPersonalRecurringByBookId(bookId)
        .then((list) =>
          setActiveRecurringCount(list.filter((r) => r.is_active).length)
        )
        .catch(() => setActiveRecurringCount(0));
    }, [bookId])
  );

  const loadMore = async () => {
    if (!bookId || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await services.bookExpense.getPersonalExpensesByBookId(
        bookId,
        next
      );
      setExpenses((prev) => [...prev, ...res.data]);
      setPage(next);
      setHasMore(res.hasNext);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  // Inline paid⇄pending toggle from the expense row. Flips optimistically across
  // the loaded page, the whole-ledger filter source, and the shared store, then
  // persists online (or queues it offline). Reverts everything on failure.
  const handleToggleStatus = async (expense: PersonalExpense) => {
    if (!bookId || togglingIds.has(expense.id)) return;
    const next = expense.status === "paid" ? "pending" : "paid";

    const apply = (status: PersonalExpense["status"]) => {
      const map = (e: PersonalExpense) =>
        e.id === expense.id ? { ...e, status } : e;
      setExpenses((prev) => prev.map(map));
      setAllExpenses((prev) => (prev ? prev.map(map) : prev));
      states.book.setState((prev) => ({
        ...prev,
        expenseList: prev.expenseList.map(map)
      }));
      // Keep the per-status totals in step for filtering and cached summaries.
      const from = status === "paid" ? "pending" : "paid";
      setTotals((prev) =>
        moveTotalsBucket(prev, expense.currency, expense.amount, from, status)
      );
    };

    apply(next);
    setTogglingIds((prev) => new Set(prev).add(expense.id));
    try {
      if (await offlineQueue.isOnline()) {
        await services.bookExpense.setPersonalExpenseStatus(expense.id, next);
        // Keep the offline snapshot coherent until the next focus refetch.
        cacheService
          .getBookDetail(bookId)
          .then((cached) => {
            if (!cached) return;
            cacheService.saveBookDetail(
              bookId,
              cached.book,
              cached.expenseList.map((e) =>
                e.id === expense.id ? { ...e, status: next } : e
              ),
              moveTotalsBucket(
                cached.totals,
                expense.currency,
                expense.amount,
                expense.status,
                next
              )
            );
          })
          .catch(() => {});
      } else {
        await offlineQueue.queueSetPersonalExpenseStatus(
          bookId,
          expense.id,
          next
        );
      }
    } catch (error) {
      console.error("Failed to update expense status:", error);
      apply(expense.status);
      toast({
        title: "Error",
        description: "Couldn't update the status. Please try again.",
        type: "error"
      });
    } finally {
      setTogglingIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(expense.id);
        return nextSet;
      });
    }
  };

  // Recurring expenses are Pro. Free users get the upgrade sheet; Pro users go
  // to the manage screen. Gates every entry point (the Expenses-tab card and the
  // ⋯ menu item) so there's no way around the paywall.
  const handleOpenRecurring = () => {
    if (!isPro) {
      setUpgradeOpen(true);
      return;
    }
    router.push(`/books/${bookId}/recurring`);
  };

  // Filters run over the whole ledger once it's in; until then (first fetch in
  // flight, or it failed) fall back to the pages already loaded.
  const filterSource = hasActiveFilters ? (allExpenses ?? expenses) : expenses;
  const filteringWholeLedger = hasActiveFilters && !!allExpenses;

  const filteredExpenses = useMemo(() => {
    if (!hasActiveFilters) return filterSource;

    const query = expenseSearch.trim().toLowerCase();
    const { start, end } = getDateRangeBounds(
      expenseDateRange,
      expenseCustomRange
    );

    return filterSource.filter((item) => {
      if (query && !item.description?.toLowerCase().includes(query)) {
        return false;
      }
      if (
        categoryFilter !== ALL_CATEGORIES &&
        item.category !== categoryFilter
      ) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!isWithinRange(item.expense_date, start, end)) return false;
      return true;
    });
  }, [
    filterSource,
    hasActiveFilters,
    expenseSearch,
    categoryFilter,
    statusFilter,
    expenseDateRange,
    expenseCustomRange
  ]);

  // Group the (filtered) rows by expense_date into dated sections, newest first
  // — mirroring the group detail Expenses tab. Ordering by expense_date keeps
  // the section a row lands in consistent with the date the row itself shows.
  const expenseSections = useMemo(() => {
    const groupedByDate: { [key: string]: PersonalExpense[] } = {};

    filteredExpenses.forEach((item) => {
      const dateKey = format(parseISO(item.expense_date), "yyyy-MM-dd");
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(item);
    });

    return Object.keys(groupedByDate)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((dateKey) => ({
        title: getDateGroupTitle(dateKey + "T00:00:00"),
        data: groupedByDate[dateKey].sort(
          (a, b) =>
            new Date(b.expense_date).getTime() -
            new Date(a.expense_date).getTime()
        )
      }));
  }, [filteredExpenses]);

  // Swap the filter row for the full-width search field (and back). The query
  // is kept when collapsing so it persists as a chip, matching group details.
  const toggleExpenseSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchOpen((prev) => !prev);
    if (!fetchedAllRef.current) fetchAllExpenses();
  };

  const handleArchive = async () => {
    if (!bookId) return;
    try {
      await services.book.archiveBook(bookId);
      states.book.setState((prev) => ({
        ...prev,
        list: prev.list.filter((b) => b.id !== bookId)
      }));
      toast({
        title: "Individual archived",
        description: "You can find it in the Archived tab.",
        type: "success"
      });
      router.back();
    } catch (error) {
      console.error("Failed to archive Individual entry:", error);
      toast({
        title: "Error",
        description: "Failed to archive Individual entry. Please try again.",
        type: "error"
      });
    }
  };

  const handleUnarchive = async () => {
    if (!bookId) return;
    try {
      await services.book.unarchiveBook(bookId);
      setBook((prev) => (prev ? { ...prev, archived: false } : prev));
      toast({
        title: "Individual restored",
        description: "Individual moved back to your active Individual entries.",
        type: "success"
      });
    } catch (error) {
      console.error("Failed to unarchive Individual entry:", error);
      toast({
        title: "Error",
        description: "Failed to restore Individual entry. Please try again.",
        type: "error"
      });
    }
  };

  const handleDeleteBook = async () => {
    if (!bookId) return;
    setDeleting(true);
    try {
      await services.book.deleteBook(bookId);
      states.book.setState((prev) => ({
        ...prev,
        list: prev.list.filter((b) => b.id !== bookId)
      }));
      toast({
        title: "Individual deleted",
        description: "The Individual entry and its expenses have been permanently deleted.",
        type: "success"
      });
      setDeleteOpen(false);
      router.back();
    } catch (error: any) {
      console.error("Failed to delete Individual entry:", error);
      toast({
        title: "Cannot delete Individual entry",
        description:
          error?.message ?? "Failed to delete Individual entry. Please try again.",
        type: "error"
      });
    } finally {
      setDeleting(false);
    }
  };

  const isArchived = !!book?.archived;

  // Combine all recorded expenses, converting only for the summary display.
  const primaryCurrency = book?.currency ?? "PHP";
  const displayTotals = totals.length
    ? [...totals].sort((a, b) =>
        a.currency === primaryCurrency
          ? -1
          : b.currency === primaryCurrency
            ? 1
            : 0
      )
    : [{ currency: primaryCurrency, paid: 0, pending: 0 }];

  const recordedByCurrency = displayTotals.map((t) => ({
    currency: t.currency,
    amount: t.paid + t.pending
  }));
  const paidByCurrency = displayTotals.map((t) => ({
    currency: t.currency,
    amount: t.paid
  }));
  const pendingByCurrency = displayTotals.map((t) => ({
    currency: t.currency,
    amount: t.pending
  }));
  const compactTotal = useConvertedTotal(recordedByCurrency, primaryCurrency);
  const compactPaid = useConvertedTotal(paidByCurrency, primaryCurrency);
  const compactPending = useConvertedTotal(pendingByCurrency, primaryCurrency);
  const totalAmountText = `${compactTotal.convertedCurrencies.length > 0 ? "≈ " : ""}${formatAmount(compactTotal.total, primaryCurrency)}`;

  // Header, tabs and total card scroll out before the compact summary appears.
  const COMPACT_THRESHOLD = 320;
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

  const renderAndroidActions = () => {
    if (loading) return undefined;

    const items: AndroidHeaderMenuItem[] = [
      ...(!isArchived
        ? [
            {
              key: "edit",
              label: "Edit",
              icon: Pencil,
              onPress: () => router.push(`/books/create?bookId=${bookId}`)
            }
          ]
        : []),
      isArchived
        ? {
            key: "unarchive",
            label: "Unarchive",
            icon: ArchiveRestore,
            onPress: handleUnarchive
          }
        : {
            key: "archive",
            label: "Archive",
            icon: Archive,
            onPress: handleArchive
          },
      {
        key: "delete",
        label: "Delete Individual",
        icon: Trash2,
        destructive: true,
        onPress: () => setDeleteOpen(true)
      }
    ];

    return (
      <HStack className="items-center gap-x-8 pr-1">
        <AndroidHeaderMenu
          accessibilityLabel="More Individual entry options"
          items={items}
        />
      </HStack>
    );
  };

  return (
    <Fragment>
      <InnerLayout
        title="Individual Details"
        onBack={() => router.back()}
        gestureEnabled={false}
        actions={
          loading ? undefined : (
            <Stack.Toolbar.Menu
              icon="ellipsis"
              tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
              accessibilityLabel="More Individual entry options"
            >
              {!isArchived && (
                <Stack.Toolbar.MenuAction
                  icon="pencil"
                  onPress={() => router.push(`/books/create?bookId=${bookId}`)}
                >
                  Edit
                </Stack.Toolbar.MenuAction>
              )}
              {isArchived ? (
                <Stack.Toolbar.MenuAction
                  icon="tray.and.arrow.up"
                  onPress={handleUnarchive}
                >
                  Unarchive
                </Stack.Toolbar.MenuAction>
              ) : (
                <Stack.Toolbar.MenuAction
                  icon="archivebox"
                  onPress={handleArchive}
                >
                  Archive
                </Stack.Toolbar.MenuAction>
              )}
              <Stack.Toolbar.MenuAction
                icon="trash"
                destructive
                onPress={() => setDeleteOpen(true)}
              >
                Delete Individual
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )
        }
        androidActions={renderAndroidActions()}
      >
        {/* Floating "+" speed-dial — Add Expense + Scan Receipt, mirroring the
            group detail FAB. Expenses tab only. */}
        {!isArchived && tab === "Expenses" && (
          <>
            {/* Speed-dial in a Modal so its dim masks the WHOLE window (native
                header + bottom toolbar included). */}
            <RNModal
              visible={fabOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setFabOpen(false)}
            >
              <Pressable
                onPress={() => setFabOpen(false)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.5)"
                }}
              />
              <Box
                className="absolute bottom-24 right-4"
                style={{
                  width: 240,
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor:
                    colorScheme === "dark" ? "#2C2C2E" : "#FFFFFF",
                  shadowColor: "#000",
                  shadowOpacity: 0.2,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 8
                }}
              >
                <Pressable
                  className="flex-row items-center justify-between px-4 py-3.5 active:opacity-60"
                  onPress={() => {
                    setFabOpen(false);
                    router.push(`/books/${bookId}/add-expense`);
                  }}
                >
                  <Text className="text-base">Add Expense</Text>
                  <ListPlus
                    size={20}
                    color={getPrimaryHex("text-primary-500", colorScheme)}
                  />
                </Pressable>
                <Box
                  style={{
                    height: 0.5,
                    backgroundColor:
                      colorScheme === "dark" ? "#3A3A3C" : "#E5E5EA"
                  }}
                />
                <Pressable
                  className="flex-row items-center justify-between px-4 py-3.5 active:opacity-60"
                  onPress={async () => {
                    setFabOpen(false);
                    if (
                      !(await ensureOnline(
                        "You need an internet connection to scan a receipt. Please try again when you're back online."
                      ))
                    ) {
                      return;
                    }
                    router.push(`/books/${bookId}/scan-receipt` as any);
                  }}
                >
                  <HStack className="items-center gap-x-2">
                    <Text className="text-base">Scan Receipt</Text>
                  </HStack>
                  <ScanLine
                    size={20}
                    color={getPrimaryHex("text-primary-500", colorScheme)}
                  />
                </Pressable>
              </Box>
            </RNModal>

            {Platform.OS === "ios" ? (
              <Stack.Toolbar placement="bottom">
                <Stack.Toolbar.Spacer />
                <Stack.Toolbar.Button
                  icon={fabOpen ? "xmark" : "plus"}
                  variant="prominent"
                  tintColor={getPrimaryHex("text-primary-500", colorScheme)}
                  accessibilityLabel={
                    fabOpen ? "Close add menu" : "Add expense"
                  }
                  onPress={() => setFabOpen((prev) => !prev)}
                />
              </Stack.Toolbar>
            ) : (
              <Fab
                placement="bottom right"
                className="bottom-10"
                aria-label={fabOpen ? "Close add menu" : "Add expense"}
                onPress={() => setFabOpen((prev) => !prev)}
              >
                {fabOpen ? (
                  <X
                    size={24}
                    color={getOnSolidHex(colorScheme)}
                  />
                ) : (
                  <Plus
                    size={24}
                    color={getOnSolidHex(colorScheme)}
                  />
                )}
              </Fab>
            )}
          </>
        )}

        <LoadingWrapper isLoading={loading} skeleton={<ExpenseListSkeleton />}>
          <ScrollView
            className="flex-1"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          >
            <VStack className="gap-y-6 py-4">
              {/* Book header — avatar + name + category, matching group detail. */}
              <HStack className="px-4 gap-x-4 items-center">
                <AppAvatar
                  className="self-center"
                  uri={book?.avatar || ""}
                  name={book?.name || "Individual"}
                  size="lg"
                />
                <VStack className="flex-1">
                  <Text bold className="text-2xl" numberOfLines={3}>
                    {book?.name}
                  </Text>
                  <Text className="text-secondary-950">
                    Last update {formatLastUpdate(book?.last_updated_at ?? book?.created_at ?? "")} • {expenses.length}
                    {hasMore ? "+" : ""} expense
                    {expenses.length !== 1 ? "s" : ""}
                  </Text>
                </VStack>
              </HStack>

              {/* Expenses / Stats tab switch, matching the group detail tabs. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <HStack className="gap-x-2 px-4">
                  {tabs.map((type) => (
                    <FormButton
                      size="sm"
                      key={type}
                      variant={type === tab ? "solid" : "outline"}
                      text={type}
                      onPress={() => setTab(type)}
                    />
                  ))}
                </HStack>
              </ScrollView>
            </VStack>

            {tab === "Expenses" && (
              <VStack className="gap-y-6 pb-4">
                <VStack className="mx-4 p-4 rounded-xl bg-secondary-100 gap-y-4">
                  <HeroAmount
                    label="Total expenses"
                    amountText={totalAmountText}
                    amountSize={amountTextSize("text-3xl", totalAmountText, 12)}
                    currency={primaryCurrency}
                    chip={
                      <CurrencyCountButton
                        items={recordedByCurrency}
                        title="Total expenses"
                        subtitle="All recorded expenses, by currency"
                        convertTo={primaryCurrency}
                        totalLabel="Total expenses"
                      />
                    }
                  />
                  <Divider />
                  <HStack className="items-stretch">
                    <VStack className="flex-1 gap-y-2">
                      <HStack className="items-center gap-x-2">
                        <Box className="bg-success-50 p-1.5 rounded-full">
                          <CircleCheck size={14} color="#2A7948" />
                        </Box>
                        <Text className="text-secondary-950 text-sm uppercase">Paid</Text>
                      </HStack>
                      <CurrencyAmountDisplay
                        items={paidByCurrency}
                        label="Paid"
                        subtitle="Paid expenses, by currency"
                        primaryCurrency={primaryCurrency}
                        convertTo={primaryCurrency}
                        totalLabel="Total paid"
                        fitAmount
                      />
                    </VStack>
                    <Divider orientation="vertical" className="mx-4" />
                    <VStack className="flex-1 gap-y-2">
                      <HStack className="items-center gap-x-2">
                        <Box className="bg-warning-50 p-1.5 rounded-full">
                          <Clock size={14} color="#D76C1F" />
                        </Box>
                        <Text className="text-secondary-950 text-sm uppercase">Pending</Text>
                      </HStack>
                      <CurrencyAmountDisplay
                        items={pendingByCurrency}
                        label="Pending"
                        subtitle="Pending expenses, by currency"
                        primaryCurrency={primaryCurrency}
                        convertTo={primaryCurrency}
                        totalLabel="Total pending"
                        fitAmount
                      />
                    </VStack>
                  </HStack>
                </VStack>

                {/* Recurring-expenses entry card — taps through to the standalone
                    /recurring route, mirroring the group detail Expenses tab. */}
                <Pressable
                  className="mx-4 bg-secondary-100 rounded-lg p-4 data-[hover=true]:bg-secondary-200 data-[active=true]:bg-secondary-200"
                  onPress={handleOpenRecurring}
                >
                  <HStack className="items-start gap-x-2">
                    <Repeat
                      size={24}
                      color={getPrimaryHex("text-primary-500", colorScheme)}
                    />
                    <HStack className="flex-1 items-center">
                      <VStack className="flex-1">
                        <HStack className="items-center gap-x-2">
                          <Text className="text-lg" bold>
                            Recurring expenses
                          </Text>
                          {!isPro && <ProBadge />}
                        </HStack>
                        <Text className="text-sm text-secondary-950">
                          {activeRecurringCount > 0
                            ? `${activeRecurringCount} active series`
                            : "Auto-post expenses on a schedule"}
                        </Text>
                      </VStack>
                      <Icon as="chevron-right" className="text-secondary-950" />
                    </HStack>
                  </HStack>
                </Pressable>

                {/* Search + date-range actions, mirroring the group detail
                    Expenses tab. Open search takes over the row; the active
                    query and range collapse into removable chips below. */}
                <VStack className="gap-y-4">
                  {searchOpen ? (
                    <HStack className="px-4 items-center gap-x-2">
                      <Box className="flex-1">
                        <SearchInput
                          autoFocus
                          value={expenseSearch}
                          onChangeText={setExpenseSearch}
                          placeholder="Search expenses"
                        />
                      </Box>
                      <FormButton
                        size="md"
                        variant="link"
                        text="Cancel"
                        onPress={toggleExpenseSearch}
                      />
                    </HStack>
                  ) : (
                    <HStack className="px-4 items-center justify-between">
                      <FormButton
                        size="sm"
                        variant="outline"
                        text={personalStatusFilterLabel(statusFilter)}
                        iconEnd={
                          <ChevronDown
                            size={16}
                            color={getOnOutlineHex(colorScheme)}
                          />
                        }
                        onPress={() => {
                          if (!fetchedAllRef.current) fetchAllExpenses();
                          setStatusFilterSheetOpen(true);
                        }}
                      />
                      <HStack className="gap-x-6 items-center">
                        <Button
                          variant="link"
                          className="rounded-full"
                          onPress={toggleExpenseSearch}
                        >
                          <Search
                            color={
                              expenseSearch
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
                          onPress={() => {
                            if (!fetchedAllRef.current) fetchAllExpenses();
                            setCategorySheetOpen(true);
                          }}
                        >
                          <Tag
                            color={
                              categoryFilter !== ALL_CATEGORIES
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
                          onPress={() => {
                            if (!fetchedAllRef.current) fetchAllExpenses();
                            setDateRangeSheetOpen(true);
                          }}
                        >
                          <CalendarRange
                            color={
                              expenseDateRange !== "All"
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

                  {(expenseDateRange !== "All" ||
                    categoryFilter !== ALL_CATEGORIES ||
                    (!!expenseSearch && !searchOpen)) && (
                    <HStack className="gap-x-2 px-4 flex-wrap">
                      {!!expenseSearch && !searchOpen && (
                        <Pressable
                          onPress={() => setExpenseSearch("")}
                          className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                        >
                          <Text
                            className="text-sm text-primary-600 max-w-[160px] dark:text-primary-800"
                            numberOfLines={1}
                          >
                            &ldquo;{expenseSearch}&rdquo;
                          </Text>
                          <X
                            size={12}
                            color={getPrimaryHex(
                              colorScheme === "dark" ? "text-primary-800" : "text-primary-600",
                              colorScheme
                            )}
                          />
                        </Pressable>
                      )}
                      {categoryFilter !== ALL_CATEGORIES && (
                        <Pressable
                          onPress={() => setCategoryFilter(ALL_CATEGORIES)}
                          className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                        >
                          <Text className="text-sm text-primary-600 dark:text-primary-800">
                            {categoryFilterLabel(categoryFilter)}
                          </Text>
                          <X
                            size={12}
                            color={getPrimaryHex(
                              colorScheme === "dark" ? "text-primary-800" : "text-primary-600",
                              colorScheme
                            )}
                          />
                        </Pressable>
                      )}
                      {expenseDateRange !== "All" && (
                        <Pressable
                          onPress={() => {
                            setExpenseDateRange("All");
                            setExpenseCustomRange(null);
                          }}
                          className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                        >
                          <Text className="text-sm text-primary-600 dark:text-primary-800">
                            {formatDateRangeLabel(
                              expenseDateRange,
                              expenseCustomRange
                            )}
                          </Text>
                          <X
                            size={12}
                            color={getPrimaryHex(
                              colorScheme === "dark" ? "text-primary-800" : "text-primary-600",
                              colorScheme
                            )}
                          />
                        </Pressable>
                      )}
                    </HStack>
                  )}
                </VStack>

                {/* Plain list — delete lives on the expense form the row opens,
                    so the row itself has no swipe actions. */}
                <SectionList
                  scrollEnabled={false}
                  sections={previewEmpty ? [] : expenseSections}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }: { item: PersonalExpense }) => (
                    <PersonalExpenseItem
                      details={item}
                      togglingStatus={togglingIds.has(item.id)}
                      onToggleStatus={() => handleToggleStatus(item)}
                      onOpen={() =>
                        router.push(
                          `/books/${bookId}/add-expense?expenseId=${item.id}`
                        )
                      }
                    />
                  )}
                  renderSectionHeader={({ section: { title } }) => (
                    <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
                      <Text className="text-sm text-secondary-950">
                        {title}
                      </Text>
                    </Box>
                  )}
                  stickySectionHeadersEnabled
                  ItemSeparatorComponent={ListDivider}
                  ListEmptyComponent={() =>
                    hasActiveFilters ? (
                      <EmptyList
                        type={EmptyType.EXPENSE}
                        content="No expenses match these filters. Clear them to see everything."
                        actions={[
                          {
                            label: "Clear Filters",
                            icon: FilterX,
                            onPress: () => {
                              setExpenseSearch("");
                              setCategoryFilter(ALL_CATEGORIES);
                              setStatusFilter("all");
                              setExpenseDateRange("All");
                              setExpenseCustomRange(null);
                            }
                          }
                        ]}
                      />
                    ) : (
                      <EmptyList
                        type={EmptyType.EXPENSE}
                        actions={expenseEmptyActions}
                      />
                    )
                  }
                  ListFooterComponent={previewEmpty ? null : (() => (
                    <>
                      {/* Filtering swaps in the whole ledger, so there's
                          nothing left to page through. */}
                      {hasMore && !filteringWholeLedger && (
                        <ListFooter
                          hasNextPage={hasMore}
                          loading={loadingMore}
                          onLoadMore={loadMore}
                        />
                      )}
                      {/* Clears the floating "+" so the last row stays
                          tappable — same gap as the group Settlements tab. */}
                      <Box className="h-16" />
                    </>
                  ))}
                />
              </VStack>
            )}

            {tab === "Stats" && bookId && (
              <BookStatsTab
                bookId={bookId}
                primaryCurrency={primaryCurrency}
                linkedGroupId={book?.group_id}
                linkedGroupName={book?.linked_group?.name}
                linkedGroupCategory={book?.linked_group?.category}
              />
            )}

            {tab === "Info" && book && <BookInfoTab book={book} />}
          </ScrollView>
        </LoadingWrapper>

        {/* Compact sticky stats — Expenses tab only. Pinned just under the
            native header as an absolute overlay that fades in once the total
            card scrolls away. Like group details, it animates only
            opacity + translateY (never height) and stays non-interactive, so it
            never reflows the list and scroll/touches pass through. */}
        {tab === "Expenses" && !loading && (
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
              {[
                { label: "Total", summary: compactTotal },
                { label: "Paid", summary: compactPaid },
                { label: "Pending", summary: compactPending }
              ].map(({ label, summary }, index) => {
                const amountText = `${summary.convertedCurrencies.length > 0 ? "≈ " : ""}${formatAmount(summary.total, primaryCurrency)}`;
                return (
                  <Fragment key={label}>
                    {index > 0 && <Text className="text-secondary-200">|</Text>}
                    <VStack className="items-center flex-1">
                      <Text
                        className="text-secondary-950 text-sm uppercase tracking-widest"
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                      <Text bold className={amountTextSize("text-lg", amountText, 11)} numberOfLines={1}>
                        {amountText}
                      </Text>
                    </VStack>
                  </Fragment>
                );
              })}
            </HStack>
          </Animated.View>
        )}
      </InnerLayout>

      <CategorySheet
        isOpen={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        category={categoryFilter}
        onSelect={setCategoryFilter}
        options={categoryFilterOptions}
      />
      <PersonalStatusFilterSheet
        isOpen={statusFilterSheetOpen}
        onClose={() => setStatusFilterSheetOpen(false)}
        status={statusFilter}
        onSelect={setStatusFilter}
      />
      <UpgradeSheet
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        description="Recurring expenses are a Pro feature. Upgrade to auto-post monthly rent, subscriptions, and other regular bills on a schedule."
      />
      <DateRangeSheet
        isOpen={dateRangeSheetOpen}
        onClose={() => setDateRangeSheetOpen(false)}
        dateRange={expenseDateRange}
        customRange={expenseCustomRange}
        onSelect={(value, custom) => {
          setExpenseDateRange(value);
          setExpenseCustomRange(custom ?? null);
        }}
      />

      {/* Delete-book confirm (menu-triggered) — mirrors DeleteGroupSheet. */}
      <ConfirmationSheet
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Individual"
        description="Permanently deleting this Individual entry will remove all of its individual expenses. This cannot be undone."
        confirmText="Delete"
        isDelete
        loading={deleting}
        onConfirm={handleDeleteBook}
      />
    </Fragment>
  );
}
