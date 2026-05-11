import EmptyList from "@/components/EmptyList";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import { Box } from "@/components/ui/box";
import { FlatList } from "@/components/ui/flat-list";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import FavoritesSheet from "@/features/friends/components/FavoritesSheet";
import FriendItem from "@/features/friends/components/FriendItem";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { FriendSummary } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { getSecondaryHex } from "@/utils/getColorHex";
import { useFocusEffect, useRouter } from "expo-router";
import { HeartPlus } from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";
import { RefreshControl, useColorScheme } from "react-native";

export default function FriendsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { details: userDetails } = states.user();
  const router = useRouter();
  const [favoritesSheetOpen, setFavoritesSheetOpen] = useState(false);

  const colorScheme = useColorScheme() ?? "light";

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id) return;
        fetchFriends(initialized);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFriends(true);
    setRefreshing(false);
  };

  const filteredFriends = useMemo(() => {
    if (!searchInput) return friends;
    const q = searchInput.toLowerCase();
    return friends.filter(
      ({ friend }) =>
        `${friend.first_name} ${friend.last_name}`.toLowerCase().includes(q) ||
        friend.email.toLowerCase().includes(q)
    );
  }, [friends, searchInput]);

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
        <Box className="px-4 pb-4 bg-background-0">
          <SearchInput
            value={searchInput}
            onChangeText={setSearchInput}
            onSetSearching={setSearching}
            placeholder="Search friends"
          />
        </Box>
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <LoadingWrapper
            isLoading={loading}
            text="Loading friends with outstanding settlements..."
          >
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.friend.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <FriendItem item={item} onPress={handleFriendPress} />
              )}
              ItemSeparatorComponent={ListDivider}
              ListEmptyComponent={() =>
                searching ? (
                  <EmptyList type={EmptyType.SEARCH} />
                ) : (
                  <EmptyList type={EmptyType.FRIEND} />
                )
              }
              ListFooterComponent={() => <Box className="h-16" />}
            />
          </LoadingWrapper>
        </ScrollView>
      </TabLayout>
      <FavoritesSheet
        isOpen={favoritesSheetOpen}
        onClose={() => setFavoritesSheetOpen(false)}
      />
    </Fragment>
  );
}
