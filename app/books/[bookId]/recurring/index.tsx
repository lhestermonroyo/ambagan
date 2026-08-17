import EmptyList from "@/components/EmptyList";
import SearchDrawer from "@/components/SearchDrawer";
import { Pressable } from "@/components/ui/pressable";
import { RefreshControl } from "@/components/ui/refresh-control";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import BookRecurring from "@/features/book/components/BookRecurring";
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import { PersonalRecurring } from "@/types/books";
import { EmptyType } from "@/types/general";
import { getPrimaryHex } from "@/utils/getColorHex";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";
import { Search } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

/**
 * Standalone route for a book's personal recurring-expense series. It owns the
 * fetch/loading state and feeds the presentational BookRecurring list — both the
 * main view and the filtered search results (in the SearchDrawer) render off the
 * same data. Search mirrors the Help Center: a right-side header button that
 * slides a search field down over the screen. Matches the group /recurring route
 * otherwise.
 */
export default function BookRecurringScreen() {
  const router = useRouter();
  const toast = useAppToast();
  const { isOnline } = useNetwork();
  const colorScheme = useColorScheme() ?? "light";
  const tintColor = getPrimaryHex("text-primary-600", colorScheme);
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const [list, setList] = useState<PersonalRecurring[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const isSearchActive = searchInput.trim().length > 0;

  const fetchList = useCallback(async () => {
    if (!bookId) return;
    try {
      setList(await services.bookRecurring.getPersonalRecurringByBookId(bookId));
    } catch {
      // Recurring reads aren't cached, so offline they simply fail — that's the
      // offline empty state, not an error worth a toast.
      if (isOnline) {
        toast({
          title: "Couldn't load",
          description: "Failed to load recurring expenses. Please try again.",
          type: "error"
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, isOnline]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchList().finally(() => setLoading(false));
    }, [fetchList])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchList();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.description.toLowerCase().includes(q));
  }, [list, searchInput]);

  const handleCancelSearch = () => {
    setSearchInput("");
    setSearchVisible(false);
  };

  // Close the drawer (keep it clean) before navigating to a result's detail, so
  // the search Modal isn't left sitting over the pushed screen.
  const openFromSearch = (item: PersonalRecurring) => {
    handleCancelSearch();
    router.push(`/books/${bookId}/recurring/${item.id}`);
  };

  return (
    <InnerLayout
      title="Recurring Expenses"
      onBack={() => router.back()}
      actions={
        <Stack.Toolbar.Button
          icon="magnifyingglass"
          tintColor={tintColor}
          accessibilityLabel="Search recurring expenses"
          onPress={() => setSearchVisible(true)}
        />
      }
      androidActions={
        <Pressable
          className="pr-1"
          aria-label="Search recurring expenses"
          onPress={() => setSearchVisible(true)}
        >
          <Search size={24} color={tintColor} />
        </Pressable>
      }
    >
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <BookRecurring
          bookId={bookId}
          items={list}
          loading={loading}
          isOnline={isOnline}
        />
      </ScrollView>

      <SearchDrawer
        isOpen={searchVisible}
        onClose={() => setSearchVisible(false)}
        onCancel={handleCancelSearch}
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder="Search recurring expenses"
      >
        {isSearchActive ? (
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <VStack className="pt-4 gap-y-2">
              <Text className="text-sm text-secondary-950 px-4" bold>
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </Text>
              {filtered.length > 0 ? (
                <BookRecurring
                  bookId={bookId}
                  items={filtered}
                  onItemPress={openFromSearch}
                />
              ) : (
                <EmptyList type={EmptyType.SEARCH} />
              )}
            </VStack>
          </ScrollView>
        ) : null}
      </SearchDrawer>
    </InnerLayout>
  );
}
