import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchDrawer from "@/components/SearchDrawer";
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
import { getRate, useFxRates } from "@/utils/fx";
import { addRecentUsers, getRecentUsers } from "@/utils/recentUsers";
import { useFocusEffect, useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
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
  const [searchVisible, setSearchVisible] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("balances");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");

  const { details: userDetails, defaultCurrency } = states.user();
  const fx = useFxRates();
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

  const handleCancelSearch = () => {
    setSearchInput("");
    setSearchVisible(false);
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

  // Filter and sort on the SAME converted net the row prints, not on the first
  // currency — otherwise a friend you owe on balance can sit under "To collect"
  // because their peso line happens to be positive. Currencies with no rate are
  // skipped, matching useConvertedTotal.
  const balanceList = useMemo(() => {
    const netOf = (friend: FriendSummary) =>
      friend.balances.reduce((sum, balance) => {
        const rate = getRate(fx, balance.currency, defaultCurrency);
        return rate === null ? sum : sum + balance.amount * rate;
      }, 0);

    const nets = new Map(friends.map((f) => [f.friend.id, netOf(f)]));
    const net = (f: FriendSummary) => nets.get(f.friend.id) ?? 0;

    const filtered =
      balanceFilter === "collect"
        ? friends.filter((f) => net(f) > 0)
        : balanceFilter === "pay"
          ? friends.filter((f) => net(f) < 0)
          : friends;
    return [...filtered].sort((a, b) => Math.abs(net(b)) - Math.abs(net(a)));
  }, [friends, balanceFilter, fx, defaultCurrency]);

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
    <TabLayout
      title="Friends"
      actions={[
        {
          key: "search",
          sf: "magnifyingglass",
          lucide: Search,
          label: "Search friends",
          onPress: () => setSearchVisible(true)
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
            {/* Balances / Contacts tabs under the search */}
            {!isSearchActive && (
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
            )}

            {/* Balance direction filter — only on the Balances tab, not searching */}
            {!isSearchActive && mainTab === "balances" && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <HStack className="gap-x-2 px-4">
                  {BALANCE_FILTERS.map((filter) => (
                    <FormButton
                      key={filter.key}
                      size="sm"
                      variant={
                        balanceFilter === filter.key ? "solid" : "outline"
                      }
                      text={filter.label}
                      onPress={() => setBalanceFilter(filter.key)}
                    />
                  ))}
                </HStack>
              </ScrollView>
            )}
          </VStack>

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
                ListHeaderComponent={() => (
                  <Text className="text-sm text-secondary-950 px-4 pb-2" bold>
                    {searchResults.length} result
                    {searchResults.length !== 1 ? "s" : ""}
                  </Text>
                )}
                ListEmptyComponent={() => <EmptyList type={EmptyType.SEARCH} />}
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
              </VStack>
            )}
          </LoadingWrapper>
        </ScrollView>

        <SearchDrawer
          isOpen={searchVisible}
          onClose={() => setSearchVisible(false)}
          onCancel={handleCancelSearch}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search friends"
        >
          {isSearchActive ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <FriendRow
                  user={item}
                  balances={balanceByUserId.get(item.id)?.balances}
                  isFavorite={favoriteIds.has(item.id)}
                  onPress={(user) => {
                    handleCancelSearch();
                    handlePress(user);
                  }}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}
              ItemSeparatorComponent={ListDivider}
              ListHeaderComponent={
                <Text className="text-sm text-secondary-950 px-4 py-2" bold>
                  {searchResults.length} result
                  {searchResults.length !== 1 ? "s" : ""}
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
