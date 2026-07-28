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
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import PersonalExpenseItem from "@/features/book/components/PersonalExpenseItem";
import { groupCategoryMeta } from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { Book, PersonalExpense } from "@/types/books";
import { EmptyType } from "@/types/general";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Trash2
} from "lucide-react-native";
import { Fragment, useCallback, useState } from "react";
import { Platform, RefreshControl, useColorScheme } from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";

export default function BookDetailScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const toast = useAppToast();
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
      } catch (error) {
        console.error("Failed to load book:", error);
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

  const handleDeleteExpense = async (expenseId: string) => {
    setDeleting(true);
    try {
      await services.bookExpense.deletePersonalExpense(expenseId);
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
        {/* Floating "+" to add an expense — mirrors the group detail FAB. A book
            has a single add action (no speed-dial), so it navigates directly. */}
        {!isArchived &&
          (Platform.OS === "ios" ? (
            <Stack.Toolbar placement="bottom">
              <Stack.Toolbar.Spacer />
              <Stack.Toolbar.Button
                icon="plus"
                variant="prominent"
                tintColor={getPrimaryHex("text-primary-500", colorScheme)}
                accessibilityLabel="Add expense"
                onPress={() => router.push(`/books/${bookId}/add-expense`)}
              />
            </Stack.Toolbar>
          ) : (
            <Fab
              placement="bottom right"
              className="bottom-10"
              aria-label="Add expense"
              onPress={() => router.push(`/books/${bookId}/add-expense`)}
            >
              <Plus
                size={24}
                color={getSecondaryHex("text-secondary-0", colorScheme)}
              />
            </Fab>
          ))}

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
                        : "text-xl text-white/80"
                    }
                  >
                    {formatAmount(t.amount, t.currency)}
                  </Text>
                ))}
                <Text className="text-sm text-white/60">
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
                        handleDeleteExpense(item.id);
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
