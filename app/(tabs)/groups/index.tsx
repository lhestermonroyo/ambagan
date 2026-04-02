import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Fab, FabLabel } from "@/components/ui/fab";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import GroupItem from "@/features/group/components/GroupItem";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { useFocusEffect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SwipeListView } from "react-native-swipe-list-view";

export default function GroupsScreen() {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { list } = states.group.getState();
  const { details: userDetails } = states.user.getState();

  const router = useRouter();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id) return;

        init(initialized);
      },
      [userDetails?.id, initialized]
    )
  );

  useEffect(() => {
    if (searchInput.length > 0) {
      setSearching(true);
    } else {
      setSearching(false);
    }
  }, [searchInput]);

  const init = async (initialized = false) => {
    await fetchGroup(initialized).then(() => {
      console.log("groups initialized");
      setInitialized(true);
    });
  };

  const fetchGroup = async (isInitialized = false) => {
    if (!isInitialized) {
      setLoading(true);
    }

    try {
      const groups = await services.group.getGroupsByUserId(
        userDetails?.id || ""
      );

      if (!groups) return;

      states.group.setState((prev) => ({
        ...prev,
        list: groups
      }));
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      if (!isInitialized) {
        setLoading(false);
      }
    }
  };

  const filteredGroups = useMemo(() => {
    if (searchInput.length === 0) {
      return list;
    }

    return list.filter((g) =>
      g.name.toLowerCase().includes(searchInput.toLowerCase())
    );
  }, [searchInput, list]);

  return (
    <TabLayout title="Groups">
      <Fab
        placement="bottom right"
        className="px-6"
        isHovered={false}
        isDisabled={false}
        isPressed={false}
        onPress={() => router.push("/groups/create?isGroup=true")}
      >
        <Icon as="group-add" className="text-background-0" />
        <FabLabel>Add Group</FabLabel>
      </Fab>
      <LoadingWrapper isLoading={loading} text="Loading groups, please wait...">
        <SwipeListView
          className="flex-1"
          data={filteredGroups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GroupItem
              details={item}
              onOpen={() => router.push(`/groups/${item.id}`)}
              key={item.id}
            />
          )}
          bounces={false}
          renderHiddenItem={({ item }, rowMap) => (
            <HStack className="flex-1 justify-end items-center flex-row px-4 gap-x-2 bg-background-50">
              <Button
                variant="solid"
                className="rounded-full h-[40] w-[40] p-0"
                onPress={() => {
                  router.push(`/groups/${item.id}/edit?isGroup=true`);
                  rowMap[item.id]?.closeRow();
                }}
              >
                <Icon as="edit" className="text-background-0" />
              </Button>
            </HStack>
          )}
          rightOpenValue={-70}
          disableRightSwipe
          ItemSeparatorComponent={() => (
            <Box className="mx-4">
              <Divider className="border-secondary-100" />
            </Box>
          )}
          ListHeaderComponent={useMemo(
            () => (
              <Box className="px-4 pb-4 bg-background-0">
                <SearchInput
                  onChangeText={setSearchInput}
                  value={searchInput}
                  placeholder="Search group"
                />
              </Box>
            ),
            [searchInput]
          )}
          ListEmptyComponent={() => {
            if (searching) {
              return (
                <VStack className="flex-1 justify-center items-center p-4">
                  <Text className="text-secondary-950 text-center">
                    No results found on your search.
                  </Text>
                </VStack>
              );
            }

            return (
              <VStack className="flex-1 justify-center items-center p-4">
                <Text className="text-secondary-950 text-center">
                  No groups joined or created yet. Create a group by clicking
                  the button below.
                </Text>
              </VStack>
            );
          }}
          stickyHeaderIndices={[0]}
        />
      </LoadingWrapper>
    </TabLayout>
  );
}
