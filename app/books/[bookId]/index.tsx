import AndroidHeaderMenu, {
  type AndroidHeaderMenuItem
} from "@/components/AndroidHeaderMenu";
import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import ProBadge from "@/components/ProBadge";
import SearchInput from "@/components/SearchInput";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import UpgradeSheet from "@/components/UpgradeSheet";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from "@/components/ui/modal";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import BookBudgetCard from "@/features/book/components/BookBudgetCard";
import BookInfoTab from "@/features/book/components/BookInfoTab";
import BookStatsTab from "@/features/book/components/BookStatsTab";
import PersonalExpenseItem from "@/features/book/components/PersonalExpenseItem";
import PersonalStatusFilterSheet, {
  PersonalStatusFilter,
  personalStatusFilterLabel
} from "@/features/book/components/PersonalStatusFilterSheet";
import CategorySheet from "@/features/expense/components/CategorySheet";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
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
import {
  Book,
  PersonalBookTotal,
  PersonalExpense
} from "@/types/books";
import { EmptyType } from "@/types/general";
import { cacheService } from "@/utils/cacheService";
import { CategoryOption, expenseCategories } from "@/utils/constants";
import { formatDate, getDateGroupTitle } from "@/utils/formatDate";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
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
  LayoutGrid,
  ListPlus,
  Pencil,
  Plus,
  ScanLine,
  Search,
  Tag,
  Trash2,
  X
} from "lucide-react-native";
import { format, parseISO } from "date-fns";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import {
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

const tabs = ["Expenses", "Stats", "Book Info"] as const;

// Filter-only sentinel — no expense ever stores it, so it can share the
// CategorySheet options list with the real categories.
const ALL_CATEGORIES = "all";

const categoryFilterOptions: CategoryOption[] = [
  { label: "All Categories", value: ALL_CATEGORIES, icon: LayoutGrid },
  ...expenseCategories
];

const categoryFilterLabel = (value: string) =>
  categoryFilterOptions.find((c) => c.value === value)?.label ??
  "All Categories";

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

/** Whether a date falls in the calendar month a monthly budget is measuring. */
const isInCurrentMonth = (date: string): boolean => {
  const d = new Date(date);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
};

export default function BookDetailScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();
  const colorScheme = useColorScheme() ?? "light";

  const { details: userDetails } = states.user();
  const isPro = userDetails?.plan === "pro";

  const [book, setBook] = useState<Book | null>(
    states.book().list.find((b) => b.id === bookId) ?? null
  );
  const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
  const [totals, setTotals] = useState<PersonalBookTotal[]>([]);
  // This calendar month's spend — only used by the budget card on a 'monthly'
  // book (a 'total' budget measures against `totals` instead).
  const [monthTotals, setMonthTotals] = useState<PersonalBookTotal[]>([]);
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
      console.error("Failed to load all book expenses:", error);
    }
  }, [bookId]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!bookId) return;
      if (!isRefresh) setLoading(true);
      try {
        const [bookRes, expensesRes, totalsRes, monthTotalsRes] =
          await Promise.all([
            services.book.getBookById(bookId),
            services.bookExpense.getPersonalExpensesByBookId(bookId, 0),
            services.bookExpense.getPersonalBookTotals(bookId),
            services.bookExpense.getPersonalBookMonthTotals(bookId)
          ]);
        setBook(bookRes);
        setExpenses(expensesRes.data);
        setHasMore(expensesRes.hasNext);
        setPage(0);
        setTotals(totalsRes);
        setMonthTotals(monthTotalsRes);
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
          // Derived from the same cached snapshot — never throws once we're here.
          setMonthTotals(
            await services.bookExpense
              .getPersonalBookMonthTotals(bookId)
              .catch(() => [])
          );
          setHasMore(false);
          states.book.setState((prev) => ({
            ...prev,
            details: cached.book,
            expenseList: cached.expenseList
          }));
        } else {
          console.error("Failed to load book:", error);
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
      // Shift this expense's amount into the target bucket so the split totals
      // card tracks the toggle live.
      const from = status === "paid" ? "pending" : "paid";
      setTotals((prev) =>
        moveTotalsBucket(prev, expense.currency, expense.amount, from, status)
      );
      // Same shift for the budget card, but only when the expense actually
      // falls in the month the card is measuring.
      if (isInCurrentMonth(expense.expense_date || expense.created_at)) {
        setMonthTotals((prev) =>
          moveTotalsBucket(prev, expense.currency, expense.amount, from, status)
        );
      }
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
        title: "Book archived",
        description: "You can find it in the Archived tab.",
        type: "success"
      });
      router.back();
    } catch (error) {
      console.error("Failed to archive book:", error);
      toast({
        title: "Error",
        description: "Failed to archive book. Please try again.",
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
        title: "Book restored",
        description: "Book moved back to your active books.",
        type: "success"
      });
    } catch (error) {
      console.error("Failed to unarchive book:", error);
      toast({
        title: "Error",
        description: "Failed to restore book. Please try again.",
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
        title: "Book deleted",
        description: "The book and its expenses have been permanently deleted.",
        type: "success"
      });
      setDeleteOpen(false);
      router.back();
    } catch (error: any) {
      console.error("Failed to delete book:", error);
      toast({
        title: "Cannot delete book",
        description:
          error?.message ?? "Failed to delete book. Please try again.",
        type: "error"
      });
    } finally {
      setDeleting(false);
    }
  };

  const isArchived = !!book?.archived;

  // Show the book's primary currency first, then any other currencies used
  // (a trip book can mix PHP + JPY). Each currency stands alone — they're never
  // converted against each other, so the card shows the primary one and hides
  // the rest behind a "+N" breakdown sheet, as the group net balance does.
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

  const paidByCurrency = displayTotals.map((t) => ({
    currency: t.currency,
    amount: t.paid
  }));
  const pendingByCurrency = displayTotals.map((t) => ({
    currency: t.currency,
    amount: t.pending
  }));

  // Mirrors BookBudgetCard's own render guard — decides whether the Paid/Pending
  // totals live inside that card or as their own pair of cards.
  const hasBudget = !!book?.budget && book.budget > 0;

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
        label: "Delete Book",
        icon: Trash2,
        destructive: true,
        onPress: () => setDeleteOpen(true)
      }
    ];

    return (
      <HStack className="items-center gap-x-8 pr-1">
        <AndroidHeaderMenu
          accessibilityLabel="More book options"
          items={items}
        />
      </HStack>
    );
  };

  return (
    <Fragment>
      <InnerLayout
        title="Book Details"
        onBack={() => router.back()}
        gestureEnabled={false}
        actions={
          loading ? undefined : (
            <Stack.Toolbar.Menu
              icon="ellipsis"
              tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
              accessibilityLabel="More book options"
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
                Delete Book
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
                    <Badge size="sm" action="info" variant="solid">
                      <BadgeText>Beta</BadgeText>
                    </Badge>
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
                    color={getSecondaryHex("text-secondary-0", colorScheme)}
                  />
                ) : (
                  <Plus
                    size={24}
                    color={getSecondaryHex("text-secondary-0", colorScheme)}
                  />
                )}
              </Fab>
            )}
          </>
        )}

        <LoadingWrapper isLoading={loading} skeleton={<ExpenseListSkeleton />}>
          <ScrollView
            className="flex-1"
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
                  name={book?.name || "Book"}
                  size="lg"
                />
                <VStack className="flex-1">
                  <Text bold className="text-2xl" numberOfLines={3}>
                    {book?.name}
                  </Text>
                  <Text className="text-secondary-950">
                    {formatDate(book?.created_at || "")} • {expenses.length}
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
                {/* Budget progress — renders only when the book has a cap set.
                    A monthly budget measures this calendar month; a total one
                    measures the whole book. The Paid/Pending totals ride along
                    in the card's footer. */}
                {book && hasBudget && (
                  <BookBudgetCard
                    book={book}
                    totals={
                      book.budget_period === "total" ? totals : monthTotals
                    }
                    paidByCurrency={paidByCurrency}
                    pendingByCurrency={pendingByCurrency}
                    primaryCurrency={primaryCurrency}
                  />
                )}

                {/* No budget to hang them off — Paid (settled) and Pending
                    (upcoming/unpaid) stand on their own, each per currency. */}
                {!hasBudget && (
                  <VStack className="mx-4 gap-y-2">
                    <HStack className="gap-x-3">
                      <VStack className="flex-1 p-4 rounded-xl bg-secondary-100 gap-y-1">
                        <Text
                          bold
                          className="text-sm text-secondary-950 uppercase"
                        >
                          Paid
                        </Text>
                        <CurrencyAmountDisplay
                          items={paidByCurrency}
                          label="Paid"
                          subtitle="Settled spend, by currency"
                          primaryCurrency={primaryCurrency}
                          amountClassName="text-background-950"
                          fitAmount
                        />
                      </VStack>
                      <VStack className="flex-1 p-4 rounded-xl bg-secondary-100 gap-y-1">
                        <Text
                          bold
                          className="text-sm text-secondary-950 uppercase"
                        >
                          Pending
                        </Text>
                        <CurrencyAmountDisplay
                          items={pendingByCurrency}
                          label="Pending"
                          subtitle="Upcoming spend, by currency"
                          primaryCurrency={primaryCurrency}
                          amountClassName="text-background-950"
                          fitAmount
                        />
                      </VStack>
                    </HStack>
                  </VStack>
                )}

                {/* Recurring-expenses entry card — taps through to the standalone
                    /recurring route, mirroring the group detail Expenses tab. */}
                <Pressable
                  className="mx-4 bg-background-50 rounded-lg p-4 data-[hover=true]:bg-background-100 data-[active=true]:bg-background-100"
                  onPress={handleOpenRecurring}
                >
                  <HStack className="items-start gap-x-2">
                    <Icon as="repeat" className="text-primary-500" />
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
                            color={getPrimaryHex(
                              "text-primary-500",
                              colorScheme
                            )}
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
                            className="text-sm text-primary-600 max-w-[160px]"
                            numberOfLines={1}
                          >
                            &ldquo;{expenseSearch}&rdquo;
                          </Text>
                          <X
                            size={12}
                            color={getPrimaryHex(
                              "text-primary-600",
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
                          <Text className="text-sm text-primary-600">
                            {categoryFilterLabel(categoryFilter)}
                          </Text>
                          <X
                            size={12}
                            color={getPrimaryHex(
                              "text-primary-600",
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
                          <Text className="text-sm text-primary-600">
                            {formatDateRangeLabel(
                              expenseDateRange,
                              expenseCustomRange
                            )}
                          </Text>
                          <X
                            size={12}
                            color={getPrimaryHex(
                              "text-primary-600",
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
                  sections={expenseSections}
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
                        content="No expenses match your filters. Try adjusting your search, category, or date range."
                      />
                    ) : (
                      <EmptyList type={EmptyType.EXPENSE} />
                    )
                  }
                  ListFooterComponent={() => (
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
                    </>
                  )}
                />
              </VStack>
            )}

            {tab === "Stats" && bookId && (
              <BookStatsTab bookId={bookId} primaryCurrency={primaryCurrency} />
            )}

            {tab === "Book Info" && book && <BookInfoTab book={book} />}
          </ScrollView>
        </LoadingWrapper>
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
      <Modal
        isOpen={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
      >
        <ModalContent>
          <ModalHeader>
            <Heading size="lg">Delete Book</Heading>
          </ModalHeader>
          <ModalBody>
            <Text>
              Permanently deleting this book will remove all of its personal
              expenses. This cannot be undone.
            </Text>
          </ModalBody>
          <ModalFooter>
            <HStack className="gap-x-2">
              <FormButton
                variant="outline"
                text="Cancel"
                disabled={deleting}
                onPress={() => setDeleteOpen(false)}
              />
              <FormButton
                text="Delete"
                action="negative"
                loading={deleting}
                onPress={handleDeleteBook}
              />
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Fragment>
  );
}
