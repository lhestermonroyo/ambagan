import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import SearchInput from "@/components/SearchInput";
import { Box } from "@/components/ui/box";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import FavoritesSheet from "@/features/friends/components/FavoritesSheet";
import FriendItem from "@/features/friends/components/FriendItem";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { FriendSummary } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { UserPreview } from "@/types/user";
import { getSecondaryHex } from "@/utils/getColorHex";
import { useFocusEffect, useRouter } from "expo-router";
import { HeartPlus } from "lucide-react-native";
import { Fragment, useMemo, useRef, useState } from "react";
import { RefreshControl, useColorScheme } from "react-native";

type FriendsTab = "owes-me" | "i-owe" | "favorites";

const TABS: { key: FriendsTab; label: string }[] = [
  { key: "owes-me", label: "Owes Me" },
  { key: "i-owe", label: "I Owe" },
  { key: "favorites", label: "Favorites" }
];

export default function FriendsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [favorites, setFavorites] = useState<UserPreview[]>([]);
  const [favoritesInitialized, setFavoritesInitialized] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<FriendsTab>("owes-me");
  const [favoritesSheetOpen, setFavoritesSheetOpen] = useState(false);

  const activeTabRef = useRef<FriendsTab>("owes-me");

  const { details: userDetails } = states.user();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id) return;
        fetchFriends(initialized);
        if (activeTabRef.current === "favorites") {
          fetchFavorites(true);
        }
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
    } catch (error) {
      console.error("Failed to fetch friends:", error);
    } finally {
      if (!isInitialized) setLoading(false);
      setInitialized(true);
    }
  };

  const fetchFavorites = async (isInitialized = false) => {
    if (!userDetails?.id) return;
    if (!isInitialized) setLoading(true);
    try {
      const data = await services.friend.getFavorites(userDetails.id);
      setFavorites(data);
    } catch (error) {
      console.error("Failed to fetch favorites:", error);
    } finally {
      if (!isInitialized) setLoading(false);
      setFavoritesInitialized(true);
    }
  };

  const handleTabChange = (tab: FriendsTab) => {
    if (tab === activeTabRef.current) return;
    activeTabRef.current = tab;
    setActiveTab(tab);
    if (tab === "favorites" && !favoritesInitialized) {
      fetchFavorites();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFriends(true);
    if (activeTabRef.current === "favorites") {
      await fetchFavorites(true);
    }
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
    const list = activeTab === "i-owe" ? iOweList : owesMeList;
    if (!q) return list;
    return list.filter(
      ({ friend }) =>
        `${friend.first_name} ${friend.last_name}`.toLowerCase().includes(q) ||
        friend.email.toLowerCase().includes(q)
    );
  }, [searchInput, activeTab, owesMeList, iOweList]);

  const filteredFavorites = useMemo(() => {
    if (!searchInput) return favorites;
    const q = searchInput.toLowerCase();
    return favorites.filter(
      (u) =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [searchInput, favorites]);

  const emptyType = searching ? EmptyType.SEARCH : EmptyType.FRIEND;

  return (
    <Fragment>
      <TabLayout
        title="Friends"
        actions={[
          <Pressable
            key="favorites"
            onPress={() => setFavoritesSheetOpen(true)}
          >
            <HeartPlus
              color={getSecondaryHex("text-secondary-950", colorScheme)}
            />
          </Pressable>
        ]}
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
                    size="md"
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
          <LoadingWrapper isLoading={loading} text="Loading friends...">
            {activeTab !== "favorites" ? (
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
            ) : (
              <FlatList
                data={filteredFavorites}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <FavoriteListItem item={item} onPress={handleFavoritePress} />
                )}
                ItemSeparatorComponent={ListDivider}
                ListEmptyComponent={() => (
                  <EmptyList
                    type={searching ? EmptyType.SEARCH : EmptyType.FAVORITE}
                  />
                )}
                ListFooterComponent={() => <Box className="h-16" />}
              />
            )}
          </LoadingWrapper>
        </ScrollView>
      </TabLayout>

      <FavoritesSheet
        isOpen={favoritesSheetOpen}
        onClose={() => {
          setFavoritesSheetOpen(false);
          if (activeTab === "favorites") fetchFavorites(true);
        }}
      />
    </Fragment>
  );
}

function FavoriteListItem({
  item,
  onPress
}: {
  item: UserPreview;
  onPress: (item: UserPreview) => void;
}) {
  return (
    <PressableListItem className="p-4" onPress={() => onPress(item)}>
      <HStack className="gap-x-3 items-center">
        <AppAvatar
          name={`${item.first_name} ${item.last_name}`}
          uri={item.avatar || undefined}
        />
        <VStack className="flex-1">
          <Text className="text-lg">
            {item.first_name} {item.last_name}
          </Text>
          <Text className="text-secondary-950">{item.email}</Text>
        </VStack>
        <Icon as="chevron-right" className="text-secondary-950" />
      </HStack>
    </PressableListItem>
  );
}
