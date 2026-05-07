import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import FriendItem from "@/features/friends/components/FriendItem";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { FriendSummary } from "@/types/expenses";
import { useFocusEffect, useRouter } from "expo-router";
import { Fragment, useMemo, useState } from "react";

export default function FriendsScreen() {
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { details: userDetails } = states.user();
  const router = useRouter();

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
      <TabLayout title="Friends">
        <ScrollView className="flex-1" bounces={false}>
          <Box className="px-4 pb-4 bg-background-0">
            <SearchInput
              value={searchInput}
              onChangeText={setSearchInput}
              onSetSearching={setSearching}
              placeholder="Search friends"
            />
          </Box>
          <LoadingWrapper isLoading={loading} text="Loading friends, please wait...">
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.friend.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <FriendItem item={item} onPress={handleFriendPress} />
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
              ListEmptyComponent={() => (
                <VStack className="flex-1 justify-center items-center p-4">
                  <Text className="text-secondary-950 text-center">
                    {searching
                      ? "No results found on your search."
                      : "No friends with outstanding settlements."}
                  </Text>
                </VStack>
              )}
              ListFooterComponent={() => <Box className="h-16" />}
            />
          </LoadingWrapper>
        </ScrollView>
      </TabLayout>
    </Fragment>
  );
}
