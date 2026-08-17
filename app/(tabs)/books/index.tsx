import ConfirmIconButton from "@/components/ConfirmIconButton";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchDrawer from "@/components/SearchDrawer";
import { GroupListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import BookItem from "@/features/book/components/BookItem";
import { BookFilter } from "@/features/book/services/book.service";
import useAppToast from "@/hooks/use-app-toast";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus, Search } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { RefreshControl } from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";

const TABS: { key: BookFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "archived", label: "Archived" }
];

export default function BooksScreen() {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [books, setBooks] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<BookFilter>("all");

  const activeTabRef = useRef<BookFilter>("all");

  const { details: userDetails } = states.user();

  const router = useRouter();
  const toast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id) return;
        init(initialized, activeTabRef.current);
      },
      [userDetails?.id, initialized]
    )
  );

  const init = async (isInitialized = false, filter: BookFilter = "all") => {
    await fetchBooks(0, filter, isInitialized);
    setInitialized(true);
  };

  const fetchBooks = async (
    pageNum: number,
    filter: BookFilter,
    isInitialized = false
  ) => {
    if (!userDetails?.id) return;
    if (!isInitialized) setLoading(true);
    try {
      const result = await services.book.getBooksByUserIdPaginated(
        userDetails.id,
        pageNum,
        filter
      );
      setBooks((prev) =>
        pageNum === 0 ? result.data : [...prev, ...result.data]
      );
      setPage(pageNum);
      setHasMore(result.hasNext);
      if (filter === "all") {
        states.book.setState((prev) => ({
          ...prev,
          list: pageNum === 0 ? result.data : [...prev.list, ...result.data],
          initialized: true
        }));
      }
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      if (!isInitialized) setLoading(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      await fetchBooks(page + 1, activeTabRef.current, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTabChange = async (tab: BookFilter) => {
    if (tab === activeTabRef.current) return;
    activeTabRef.current = tab;
    setActiveTab(tab);
    setPage(0);
    setHasMore(false);
    await fetchBooks(0, tab, true);
  };

  const handleArchiveBook = async (bookId: string) => {
    setArchiving(true);
    try {
      await services.book.archiveBook(bookId);
      toast({
        title: "Book archived",
        description: "You can find it in the Archived tab.",
        type: "success"
      });
      await fetchBooks(0, activeTabRef.current, true);
    } catch (error) {
      console.error("Failed to archive book:", error);
      toast({
        title: "Error",
        description: "Failed to archive book. Please try again.",
        type: "error"
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchiveBook = async (bookId: string) => {
    setArchiving(true);
    try {
      await services.book.unarchiveBook(bookId);
      toast({
        title: "Book restored",
        description: "Book has been moved back to your active books.",
        type: "success"
      });
      await fetchBooks(0, activeTabRef.current, true);
    } catch (error) {
      console.error("Failed to unarchive book:", error);
      toast({
        title: "Error",
        description: "Failed to restore book. Please try again.",
        type: "error"
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    setDeleting(true);
    try {
      await services.book.deleteBook(bookId);
      toast({
        title: "Book deleted",
        description: "The book and its expenses have been permanently deleted.",
        type: "success"
      });
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      states.book.setState((prev) => ({
        ...prev,
        list: prev.list.filter((b) => b.id !== bookId)
      }));
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBooks(0, activeTabRef.current, true);
    setRefreshing(false);
  };

  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    setSearching(text.length > 0);
  };

  const handleCancelSearch = () => {
    setSearchInput("");
    setSearching(false);
    setSearchVisible(false);
  };

  const filteredBooks = useMemo(() => {
    if (searchInput.length === 0) return books;
    return books.filter((b) =>
      b.name.toLowerCase().includes(searchInput.toLowerCase())
    );
  }, [searchInput, books]);

  return (
    <TabLayout
      title="Books"
      actions={[
        {
          key: "search",
          sf: "magnifyingglass",
          lucide: Search,
          label: "Search books",
          onPress: () => setSearchVisible(true)
        },
        {
          key: "add",
          sf: "plus",
          lucide: Plus,
          label: "Add book",
          onPress: () => router.push("/books/create")
        }
      ]}
    >
      <Box className="flex-1 bg-background-0">
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <VStack className="bg-background-0 pb-4 gap-y-4 pt-2">
            {!searching && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <HStack className="gap-x-2 px-4">
                  {TABS.map((tab) => (
                    <FormButton
                      key={tab.key}
                      size="sm"
                      variant={activeTab === tab.key ? "solid" : "outline"}
                      text={tab.label}
                      onPress={() => handleTabChange(tab.key)}
                    />
                  ))}
                </HStack>
              </ScrollView>
            )}
          </VStack>

          <LoadingWrapper isLoading={loading} skeleton={<GroupListSkeleton />}>
            <SwipeListView
              className="flex-1"
              scrollEnabled={false}
              data={filteredBooks}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <BookItem
                  details={item}
                  onOpen={() => router.push(`/books/${item.id}`)}
                  key={item.id}
                />
              )}
              renderHiddenItem={({ item }, rowMap) => (
                <HStack className="flex-1 justify-end items-center flex-row px-4 gap-x-2 bg-background-50">
                  {activeTab === "archived" ? (
                    <>
                      <ConfirmIconButton
                        icon="unarchive"
                        iconClassName="text-background-0"
                        variant="solid"
                        className="rounded-full h-[40] w-[40] p-0"
                        confirmTitle="Restore Book"
                        confirmDescription="This will move the book back to your active books."
                        isLoading={archiving}
                        onConfirm={() => {
                          rowMap[item.id]?.closeRow();
                          handleUnarchiveBook(item.id);
                        }}
                      />
                      <ConfirmIconButton
                        icon="delete"
                        iconClassName="text-background-0"
                        variant="solid"
                        action="negative"
                        className="rounded-full h-[40] w-[40] p-0"
                        confirmTitle="Delete Book"
                        confirmDescription="Permanently deleting this book will remove all of its personal expenses. This cannot be undone."
                        isDelete
                        isLoading={deleting}
                        onConfirm={() => {
                          rowMap[item.id]?.closeRow();
                          handleDeleteBook(item.id);
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Button
                        variant="solid"
                        className="rounded-full h-[40] w-[40] p-0"
                        onPress={() => {
                          router.push(`/books/create?bookId=${item.id}`);
                          rowMap[item.id]?.closeRow();
                        }}
                      >
                        <Icon as="edit" className="text-background-0" />
                      </Button>
                      <ConfirmIconButton
                        icon="archive"
                        iconClassName="text-background-0"
                        variant="solid"
                        className="rounded-full h-[40] w-[40] p-0"
                        confirmTitle="Archive Book"
                        confirmDescription="This book will be archived and hidden from your active list. You can restore it anytime from the Archived tab."
                        isLoading={archiving}
                        onConfirm={() => {
                          rowMap[item.id]?.closeRow();
                          handleArchiveBook(item.id);
                        }}
                      />
                      <ConfirmIconButton
                        icon="delete"
                        iconClassName="text-background-0"
                        variant="solid"
                        action="negative"
                        className="rounded-full h-[40] w-[40] p-0"
                        confirmTitle="Delete Book"
                        confirmDescription="Permanently deleting this book will remove all of its personal expenses. This cannot be undone."
                        isDelete
                        isLoading={deleting}
                        onConfirm={() => {
                          rowMap[item.id]?.closeRow();
                          handleDeleteBook(item.id);
                        }}
                      />
                    </>
                  )}
                </HStack>
              )}
              rightOpenValue={activeTab === "archived" ? -116 : -174}
              disableRightSwipe
              ItemSeparatorComponent={ListDivider}
              ListHeaderComponent={() =>
                searching && (
                  <Text className="text-sm text-secondary-950 px-4 pb-2" bold>
                    {filteredBooks.length} result
                    {filteredBooks.length !== 1 ? "s" : ""}
                  </Text>
                )
              }
              ListEmptyComponent={() => (
                <EmptyList
                  type={searching ? EmptyType.SEARCH : EmptyType.BOOK}
                />
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
          </LoadingWrapper>
        </ScrollView>

        <SearchDrawer
          isOpen={searchVisible}
          onClose={() => setSearchVisible(false)}
          onCancel={handleCancelSearch}
          value={searchInput}
          onChangeText={handleSearchChange}
          placeholder="Search books"
        >
          {searching ? (
            <FlatList
              data={filteredBooks}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <BookItem
                  details={item}
                  onOpen={() => {
                    handleCancelSearch();
                    router.push(`/books/${item.id}`);
                  }}
                />
              )}
              ItemSeparatorComponent={ListDivider}
              ListHeaderComponent={
                <Text className="text-sm text-secondary-950 px-4 py-2" bold>
                  {filteredBooks.length} result
                  {filteredBooks.length !== 1 ? "s" : ""}
                </Text>
              }
              ListEmptyComponent={<EmptyList type={EmptyType.SEARCH} />}
            />
          ) : null}
        </SearchDrawer>
      </Box>
    </TabLayout>
  );
}
