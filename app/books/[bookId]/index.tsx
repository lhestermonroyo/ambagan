import AndroidHeaderMenu, {
  type AndroidHeaderMenuItem
} from "@/components/AndroidHeaderMenu";
import AppAvatar from "@/components/AppAvatar";
import ConfirmIconButton from "@/components/ConfirmIconButton";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
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
import PersonalExpenseItem from "@/features/book/components/PersonalExpenseItem";
import { groupCategoryMeta } from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { Book, PersonalExpense } from "@/types/books";
import { EmptyType } from "@/types/general";
import { cacheService } from "@/utils/cacheService";
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
  ListPlus,
  Pencil,
  Plus,
  ScanLine,
  Trash2,
  X
} from "lucide-react-native";
import { Fragment, useCallback, useState } from "react";
import {
  Platform,
  RefreshControl,
  Modal as RNModal,
  useColorScheme
} from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";

export default function BookDetailScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();
  const colorScheme = useColorScheme() ?? "light";

  const [book, setBook] = useState<Book | null>(
    states.book().list.find((b) => b.id === bookId) ?? null
  );
  const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
  const [totals, setTotals] = useState<{ currency: string; amount: number }[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!bookId) return;
      if (!isRefresh) setLoading(true);
      try {
        const [bookRes, expensesRes, totalsRes] = await Promise.all([
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
          console.error("Failed to load book:", error);
        }
      } finally {
        setLoading(false);
      }
    },
    [bookId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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

  const handleDeleteExpense = async (expense: PersonalExpense) => {
    if (!bookId) return;
    setDeleting(true);
    try {
      // Offline → queue + optimistic cache removal (adjusts the cached totals),
      // then reload from cache so the list + total stay consistent.
      if (!(await offlineQueue.isOnline())) {
        await offlineQueue.queueDeletePersonalExpense(
          bookId,
          expense.id,
          expense.amount,
          expense.currency
        );
        toast({
          title: "Deleted offline",
          description: "This will sync when you're back online.",
          type: "info"
        });
        await load(true);
        return;
      }
      await services.bookExpense.deletePersonalExpense(expense.id);
      toast({
        title: "Expense deleted",
        description: "The expense has been removed.",
        type: "success"
      });
      await load(true);
    } catch (error) {
      console.error("Failed to delete expense:", error);
      toast({
        title: "Error",
        description: "Failed to delete expense. Please try again.",
        type: "error"
      });
    } finally {
      setDeleting(false);
    }
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
  // (a trip book can mix PHP + JPY). Each currency is its own line — they're
  // never converted against each other.
  const primaryCurrency = book?.currency ?? "PHP";
  const displayTotals = totals.length
    ? [...totals].sort((a, b) =>
        a.currency === primaryCurrency
          ? -1
          : b.currency === primaryCurrency
            ? 1
            : 0
      )
    : [{ currency: primaryCurrency, amount: 0 }];

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
            group detail FAB. */}
        {!isArchived && (
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
                    {groupCategoryMeta(book?.category ?? "general").label}
                    {isArchived ? " · Archived" : ""}
                  </Text>
                </VStack>
              </HStack>

              {/* Total spent, per currency — net-balance hero treatment. */}
              <VStack className="mx-4 p-4 rounded-xl bg-secondary-100 gap-y-2">
                <Text className="text-sm text-white font-medium uppercase">
                  Total Spent
                </Text>
                {displayTotals.map((t, i) => (
                  <Text
                    key={t.currency}
                    bold
                    className={
                      i === 0
                        ? "text-3xl text-primary-400"
                        : "text-xl text-white/70"
                    }
                  >
                    {formatAmount(t.amount, t.currency)}
                  </Text>
                ))}
                <Text className="text-sm text-white/70">
                  {expenses.length}
                  {hasMore ? "+" : ""} expense
                  {expenses.length !== 1 ? "s" : ""}
                </Text>
              </VStack>

              <SwipeListView
                scrollEnabled={false}
                data={expenses}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <PersonalExpenseItem
                    details={item}
                    onOpen={() =>
                      router.push(
                        `/books/${bookId}/add-expense?expenseId=${item.id}`
                      )
                    }
                  />
                )}
                renderHiddenItem={({ item }, rowMap) => (
                  <HStack className="flex-1 justify-end items-center px-4 gap-x-2 bg-background-50">
                    <ConfirmIconButton
                      icon="delete"
                      iconClassName="text-background-0"
                      variant="solid"
                      action="negative"
                      className="rounded-full h-[40] w-[40] p-0"
                      confirmTitle="Delete Expense"
                      confirmDescription="This expense will be permanently removed. This cannot be undone."
                      isDelete
                      isLoading={deleting}
                      onConfirm={() => {
                        rowMap[item.id]?.closeRow();
                        handleDeleteExpense(item);
                      }}
                    />
                  </HStack>
                )}
                rightOpenValue={-64}
                disableRightSwipe
                ItemSeparatorComponent={ListDivider}
                ListEmptyComponent={() => (
                  <EmptyList type={EmptyType.EXPENSE} />
                )}
                ListFooterComponent={() => (
                  <>
                    {hasMore && (
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
          </ScrollView>
        </LoadingWrapper>
      </InnerLayout>

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
