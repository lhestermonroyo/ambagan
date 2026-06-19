import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import SearchInput from "@/components/SearchInput";
import { FriendListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import FriendItem from "@/features/friends/components/FriendItem";
import { useFavoriteToggle } from "@/features/group/hooks/useFavoriteToggle";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { FriendSummary } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { UserPreview } from "@/types/user";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { addRecentUsers, getRecentUsers } from "@/utils/recentUsers";
import { useFocusEffect, useRouter } from "expo-router";
import { Heart } from "lucide-react-native";
import { Fragment, useMemo, useRef, useState } from "react";
import { RefreshControl, useColorScheme } from "react-native";

type FriendsTab = "all" | "owes-me" | "i-owe" | "friends" | "favorites";

const TABS: { key: FriendsTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "owes-me", label: "To Collect" },
  { key: "i-owe", label: "To Pay" },
  { key: "friends", label: "Friends" },
  { key: "favorites", label: "Favorites" }
];

export default function FriendsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [recentFriends, setRecentFriends] = useState<UserPreview[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<FriendsTab>("all");

  const activeTabRef = useRef<FriendsTab>("all");

  const { details: userDetails } = states.user();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  const { favoriteIds, favoriteUsers, loadFavorites, handleToggleFavorite } =
    useFavoriteToggle(userDetails?.id);

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id) return;
        fetchFriends(initialized);
        loadFavorites();
        loadRecentFriends();
      },
      [userDetails?.id, initialized]
    )
  );

  const fetchFriends = async (isInitialized = false) => {
    if (!userDetails?.id) return;
    if (!isInitialized) setLoading(true);
    try {
      const data = await services.friend.getFriendsSummary(userDetails.id);
      setFriends(data);
      addRecentUsers(data.map((f) => f.friend), userDetails.id).catch(() => {});
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

  const handleTabChange = (tab: FriendsTab) => {
    if (tab === activeTabRef.current) return;
    activeTabRef.current = tab;
    setActiveTab(tab);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFriends(true), loadFavorites(), loadRecentFriends()]);
    setRefreshing(false);
  };

  const handleFriendPress = (item: FriendSummary) => {
    router.push({
      pathname: "/friends/[friendId]",
      params: {
        friendId: item.friend.id,
        name: `${item.friend.first_name} ${item.friend.last_name}`,
        email: item.friend.email,
        avatar: item.friend.avatar || ""
      }
    });
  };

  const handleFavoritePress = (user: UserPreview) => {
    router.push({
      pathname: "/friends/[friendId]",
      params: {
        friendId: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        avatar: user.avatar || ""
      }
    });
  };

  const allList = useMemo(
    () =>
      [...friends].sort(
        (a, b) =>
          Math.abs(b.balances[0]?.amount ?? 0) -
          Math.abs(a.balances[0]?.amount ?? 0)
      ),
    [friends]
  );

  const owesMeList = useMemo(
    () => friends.filter((f) => (f.balances[0]?.amount ?? 0) > 0),
    [friends]
  );

  const iOweList = useMemo(
    () => friends.filter((f) => (f.balances[0]?.amount ?? 0) < 0),
    [friends]
  );

  const filteredFriends = useMemo(() => {
    const q = searchInput.toLowerCase();
    const list =
      activeTab === "all"
        ? allList
        : activeTab === "i-owe"
          ? iOweList
          : owesMeList;
    if (!q) return list;
    return list.filter(
      ({ friend }) =>
        `${friend.first_name} ${friend.last_name}`.toLowerCase().includes(q) ||
        friend.email.toLowerCase().includes(q)
    );
  }, [searchInput, activeTab, allList, owesMeList, iOweList]);

  const filteredFavorites = useMemo(() => {
    if (!searchInput) return favoriteUsers;
    const q = searchInput.toLowerCase();
    return favoriteUsers.filter(
      (u) =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [searchInput, favoriteUsers]);

  const filteredRecentFriends = useMemo(() => {
    if (!searchInput) return recentFriends;
    const q = searchInput.toLowerCase();
    return recentFriends.filter(
      (u) =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [searchInput, recentFriends]);

  const emptyType = searching ? EmptyType.SEARCH : EmptyType.FRIEND;

  return (
    <Fragment>
      <TabLayout
        title="Friends"
        actions={[]}
      >
        <VStack className="bg-background-0 pb-3 gap-y-3">
          <Box className="px-4">
            <SearchInput
              value={searchInput}
              onChangeText={setSearchInput}
              onSetSearching={setSearching}
              placeholder="Search friends"
            />
          </Box>

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

        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <LoadingWrapper isLoading={loading} skeleton={<FriendListSkeleton />}>
            {activeTab === "friends" ? (
              <FlatList
                data={filteredRecentFriends}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <FavoriteListItem
                    item={item}
                    isFavorite={favoriteIds.has(item.id)}
                    onPress={handleFavoritePress}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
                ItemSeparatorComponent={ListDivider}
                ListEmptyComponent={() => (
                  <EmptyList
                    type={searching ? EmptyType.SEARCH : EmptyType.FRIEND}
                  />
                )}
                ListFooterComponent={() => <Box className="h-16" />}
              />
            ) : activeTab !== "favorites" ? (
              <>
                {activeTab === "all" && filteredFavorites.length > 0 && (
                  <VStack className="gap-y-2">
                    <Text
                      bold
                      className="text-secondary-950 uppercase text-sm px-4"
                    >
                      Favorites
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <HStack className="px-4 pb-3">
                        {filteredFavorites.map((fav) => (
                          <Pressable
                            key={fav.id}
                            style={{ maxWidth: 100 }}
                            className="p-2"
                            onPress={() => handleFavoritePress(fav)}
                          >
                            <VStack className="relative justify-center items-center gap-y-2">
                              <AppAvatar
                                name={fav.first_name}
                                uri={fav.avatar || undefined}
                                size="lg"
                                className="rounded-full"
                              />
                              <VStack className="items-center gap-y-0">
                                <Text className="text-center break-words">
                                  {fav.first_name} {fav.last_name}
                                </Text>
                              </VStack>
                            </VStack>
                          </Pressable>
                        ))}
                      </HStack>
                    </ScrollView>
                  </VStack>
                )}
                {activeTab === "all" && searchInput.length > 0 ? (
                  filteredFriends.length > 0 ? (
                    <VStack className="gap-y-2">
                      {filteredFavorites.length > 0 && (
                        <Text
                          bold
                          className="text-secondary-950 uppercase text-sm px-4"
                        >
                          Settlements
                        </Text>
                      )}
                      <FlatList
                        data={filteredFriends}
                        keyExtractor={(item) => item.friend.id}
                        scrollEnabled={false}
                        renderItem={({ item }) => (
                          <FriendItem item={item} onPress={handleFriendPress} />
                        )}
                        ItemSeparatorComponent={ListDivider}
                        ListFooterComponent={() => <Box className="h-16" />}
                      />
                    </VStack>
                  ) : filteredFavorites.length === 0 ? (
                    <EmptyList type={EmptyType.SEARCH} />
                  ) : null
                ) : (
                  <VStack className="gap-y-2">
                    {activeTab === "all" && (
                      <Text
                        bold
                        className="text-secondary-950 uppercase text-sm px-4"
                      >
                        Settlements
                      </Text>
                    )}
                    <FlatList
                      data={filteredFriends}
                      keyExtractor={(item) => item.friend.id}
                      scrollEnabled={false}
                      renderItem={({ item }) => (
                        <FriendItem item={item} onPress={handleFriendPress} />
                      )}
                      ItemSeparatorComponent={ListDivider}
                      ListEmptyComponent={() => <EmptyList type={emptyType} />}
                      ListFooterComponent={() => <Box className="h-16" />}
                    />
                  </VStack>
                )}
              </>
            ) : (
              <FlatList
                data={filteredFavorites}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <FavoriteListItem
                    item={item}
                    isFavorite={favoriteIds.has(item.id)}
                    onPress={handleFavoritePress}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
                ItemSeparatorComponent={ListDivider}
                ListEmptyComponent={() => (
                  <EmptyList
                    type={searching ? EmptyType.SEARCH : EmptyType.FAVORITE}
                  />
                )}
                ListFooterComponent={() => <Box className="h-16" />}
              />
            )
            }
          </LoadingWrapper>
        </ScrollView>
      </TabLayout>

    </Fragment>
  );
}

function FavoriteListItem({
  item,
  isFavorite = false,
  onPress,
  onToggleFavorite
}: {
  item: UserPreview;
  isFavorite?: boolean;
  onPress: (item: UserPreview) => void;
  onToggleFavorite?: (item: UserPreview) => void;
}) {
  const colorScheme = useColorScheme() ?? "light";

  return (
    <PressableListItem className="p-4" onPress={() => onPress(item)}>
      <HStack className="gap-x-3 items-center">
        <AppAvatar name={item.first_name} uri={item.avatar || undefined} />
        <VStack className="flex-1">
          <Text className="text-lg">
            {item.first_name} {item.last_name}
          </Text>
          <Text className="text-secondary-950">{item.email}</Text>
        </VStack>
        <HStack className="gap-x-3 items-center">
          {onToggleFavorite && (
            <Pressable onPress={() => onToggleFavorite(item)}>
              <Heart
                size={18}
                color={
                  isFavorite
                    ? getPrimaryHex("text-primary-400", colorScheme)
                    : getSecondaryHex("text-secondary-950", colorScheme)
                }
                fill={
                  isFavorite
                    ? getPrimaryHex("text-primary-400", colorScheme)
                    : "none"
                }
              />
            </Pressable>
          )}
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
