import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import { FriendListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import FriendRow from "@/features/friends/components/FriendRow";
import { useFavoriteToggle } from "@/features/group/hooks/useFavoriteToggle";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { FriendSummary } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { UserPreview } from "@/types/user";
import { addRecentUsers, getRecentUsers } from "@/utils/recentUsers";
import { useFocusEffect, useRouter } from "expo-router";
import { Fragment, useCallback, useMemo, useState } from "react";
import { RefreshControl } from "react-native";

type MainTab = "balances" | "contacts";
type BalanceFilter = "all" | "collect" | "pay";

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: "balances", label: "Balances" },
  { key: "contacts", label: "Contacts" }
];

const BALANCE_FILTERS: { key: BalanceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "collect", label: "To collect" },
  { key: "pay", label: "To pay" }
];

export default function FriendsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [recentFriends, setRecentFriends] = useState<UserPreview[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("balances");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");

  const { details: userDetails } = states.user();
  const router = useRouter();

  const { favoriteIds, favoriteUsers, loadFavorites, handleToggleFavorite } =
    useFavoriteToggle(userDetails?.id);

  useFocusEffect(
    useCallback(() => {
      if (!userDetails?.id) return;
      fetchFriends(initialized);
      loadFavorites();
      loadRecentFriends();
    }, [userDetails?.id, initialized])
  );

  const fetchFriends = async (isInitialized = false) => {
    if (!userDetails?.id) return;
    if (!isInitialized) setLoading(true);
    try {
      const data = await services.friend.getFriendsSummary(userDetails.id);
      setFriends(data);
      addRecentUsers(
        data.map((f) => f.friend),
        userDetails.id
      ).catch(() => {});
    } catch (error) {
      console.error("Failed to fetch friends:", error);
    } finally {
      if (!isInitialized) setLoading(false);
      setInitialized(true);
    }
  };

  const loadRecentFriends = async () => {
    if (!userDetails?.id) return;
    try {
      const data = await getRecentUsers(userDetails.id);
      setRecentFriends(data.filter((u) => u.id !== userDetails.id));
    } catch (error) {
      console.error("Failed to load recent friends:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchFriends(true),
      loadFavorites(),
      loadRecentFriends()
    ]);
    setRefreshing(false);
  };

  const handlePress = useCallback(
    (user: UserPreview) => {
      router.push({
        pathname: "/friends/[friendId]",
        params: {
          friendId: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          avatar: user.avatar || ""
        }
      });
    },
    [router]
  );

  // Balance lookup so any row (search/contacts) can show an amount if the
  // person is also someone we share money with.
  const balanceByUserId = useMemo(() => {
    const map = new Map<string, FriendSummary>();
    friends.forEach((f) => map.set(f.friend.id, f));
    return map;
  }, [friends]);

  // The full people directory: favorites + people we have balances with +
  // recent contacts, de-duplicated (favorites kept first).
  const allContacts = useMemo(() => {
    const map = new Map<string, UserPreview>();
    [
      ...favoriteUsers,
      ...friends.map((f) => f.friend),
      ...recentFriends
    ].forEach((u) => {
      if (u.id !== userDetails?.id && !map.has(u.id)) map.set(u.id, u);
    });
    return Array.from(map.values());
  }, [favoriteUsers, friends, recentFriends, userDetails?.id]);

  const matchesQuery = (u: UserPreview, q: string) =>
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q);

  const isSearchActive = searchInput.trim().length > 0;

  // Global search across the whole directory; each row adapts (amount if the
  // person has a balance, none otherwise) and always shows the favorite toggle.
  const searchResults = useMemo(() => {
    if (!isSearchActive) return [];
    const q = searchInput.toLowerCase().trim();
    return allContacts.filter((u) => matchesQuery(u, q));
  }, [isSearchActive, searchInput, allContacts]);

  const balanceList = useMemo(() => {
    const filtered =
      balanceFilter === "collect"
        ? friends.filter((f) => (f.balances[0]?.amount ?? 0) > 0)
        : balanceFilter === "pay"
          ? friends.filter((f) => (f.balances[0]?.amount ?? 0) < 0)
          : friends;
    return [...filtered].sort(
      (a, b) =>
        Math.abs(b.balances[0]?.amount ?? 0) -
        Math.abs(a.balances[0]?.amount ?? 0)
    );
  }, [friends, balanceFilter]);

  const favoriteContacts = useMemo(
    () => allContacts.filter((u) => favoriteIds.has(u.id)),
    [allContacts, favoriteIds]
  );

  const otherContacts = useMemo(
    () => allContacts.filter((u) => !favoriteIds.has(u.id)),
    [allContacts, favoriteIds]
  );

  const renderContactRow = useCallback(
    ({ item }: { item: UserPreview }) => (
      <FriendRow
        user={item}
        isFavorite={favoriteIds.has(item.id)}
        onPress={handlePress}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [favoriteIds, handlePress, handleToggleFavorite]
  );

  return (
    <Fragment>
      <TabLayout title="Friends" actions={[]}>
        <VStack className="bg-background-0 pb-3 gap-y-3">
          <Box className="px-4">
            <SearchInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search friends"
            />
          </Box>

          {/* Balances / Contacts tabs under the search */}
          <HStack className="px-4 gap-x-2">
            {MAIN_TABS.map((tab) => (
              <FormButton
                key={tab.key}
                className="flex-1"
                size="sm"
                variant={mainTab === tab.key ? "solid" : "outline"}
                text={tab.label}
                onPress={() => setMainTab(tab.key)}
              />
            ))}
          </HStack>

          {/* Balance direction filter — only on the Balances tab, not searching */}
          {!isSearchActive && mainTab === "balances" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <HStack className="gap-x-2 px-4">
                {BALANCE_FILTERS.map((filter) => (
                  <FormButton
                    key={filter.key}
                    size="sm"
                    variant={balanceFilter === filter.key ? "solid" : "outline"}
                    text={filter.label}
                    onPress={() => setBalanceFilter(filter.key)}
                  />
                ))}
              </HStack>
            </ScrollView>
          )}
        </VStack>

        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <LoadingWrapper isLoading={loading} skeleton={<FriendListSkeleton />}>
            {isSearchActive ? (
              // Unified global search across balances + contacts.
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <FriendRow
                    user={item}
                    balances={balanceByUserId.get(item.id)?.balances}
                    isFavorite={favoriteIds.has(item.id)}
                    onPress={handlePress}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
                ItemSeparatorComponent={ListDivider}
                ListEmptyComponent={() => <EmptyList type={EmptyType.SEARCH} />}
                ListFooterComponent={() => <Box className="h-16" />}
              />
            ) : mainTab === "balances" ? (
              <FlatList
                data={balanceList}
                keyExtractor={(item) => item.friend.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <FriendRow
                    user={item.friend}
                    balances={item.balances}
                    isFavorite={favoriteIds.has(item.friend.id)}
                    onPress={handlePress}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
                ItemSeparatorComponent={ListDivider}
                ListEmptyComponent={() => <EmptyList type={EmptyType.FRIEND} />}
                ListFooterComponent={() => <Box className="h-16" />}
              />
            ) : (
              // Contacts directory — favorites pinned, then everyone else.
              <VStack className="gap-y-2">
                {favoriteContacts.length > 0 && (
                  <VStack className="gap-y-2">
                    <Text
                      bold
                      className="text-sm text-secondary-950 uppercase px-4 pt-2"
                    >
                      Favorites
                    </Text>
                    <FlatList
                      data={favoriteContacts}
                      keyExtractor={(item) => item.id}
                      scrollEnabled={false}
                      renderItem={renderContactRow}
                      ItemSeparatorComponent={ListDivider}
                    />
                  </VStack>
                )}
                <VStack className="gap-y-2">
                  {favoriteContacts.length > 0 && otherContacts.length > 0 && (
                    <Text
                      bold
                      className="text-sm text-secondary-950 uppercase px-4 pt-2"
                    >
                      All Contacts
                    </Text>
                  )}
                  <FlatList
                    data={otherContacts}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={renderContactRow}
                    ItemSeparatorComponent={ListDivider}
                    ListEmptyComponent={() =>
                      favoriteContacts.length === 0 ? (
                        <EmptyList type={EmptyType.FRIEND} />
                      ) : null
                    }
                  />
                </VStack>
                <Box className="h-16" />
              </VStack>
            )}
          </LoadingWrapper>
        </ScrollView>
      </TabLayout>
    </Fragment>
  );
}
