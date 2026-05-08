import ConfirmIconButton from "@/components/ConfirmIconButton";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Fab, FabLabel } from "@/components/ui/fab";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import GroupItem from "@/features/group/components/GroupItem";
import useAppToast from "@/hooks/use-app-toast";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { getSecondaryHex } from "@/utils/getColorHex";
import { useFocusEffect, useRouter } from "expo-router";
import { HousePlus } from "lucide-react-native";
import { Fragment, useEffect, useMemo, useState } from "react";
import { RefreshControl, useColorScheme } from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";

export default function GroupsScreen() {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { list } = states.group();
  const { details: userDetails } = states.user();

  const colorScheme = useColorScheme() ?? "light";
  const router = useRouter();
  const toast = useAppToast();

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
      setInitialized(true);
    });
  };

  const fetchGroup = async (isInitialized = false) => {
    if (!userDetails?.id) return;

    if (!isInitialized) {
      setLoading(true);
    }

    try {
      const groups = await services.group.getGroupsByUserId(userDetails.id);

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

  const handleDeleteGroup = async (groupId: string) => {
    setDeleting(true);
    try {
      const response = await services.group.deleteGroup(groupId);

      if (response.success) {
        toast({
          title: "Group deleted",
          description: "Group deleted successfully.",
          type: "success"
        });
        await fetchGroup(true);
      }
    } catch (error) {
      console.error("Failed to delete group:", error);
      toast({
        title: "Error",
        description: "Failed to delete group. Please try again.",
        type: "error"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGroup(true);
    setRefreshing(false);
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
    <Fragment>
      <Fab
        placement="bottom right"
        className="px-6"
        isHovered={false}
        isDisabled={false}
        isPressed={false}
        onPress={() => router.push("/groups/create")}
      >
        <HousePlus
          size={20}
          color={getSecondaryHex("text-secondary-0", colorScheme)}
        />
        <FabLabel className="text-lg font-medium">Add Group</FabLabel>
      </Fab>
      <TabLayout title="Groups">
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <Box className="px-4 pb-4 bg-background-0">
            <SearchInput
              onChangeText={setSearchInput}
              value={searchInput}
              placeholder="Search group"
            />
          </Box>
          <LoadingWrapper
            isLoading={loading}
            text="Loading groups, please wait..."
          >
            <SwipeListView
              className="flex-1"
              scrollEnabled={false}
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
              renderHiddenItem={({ item }, rowMap) =>
                item.admin.id === userDetails?.id && (
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
                    <ConfirmIconButton
                      icon="delete"
                      iconClassName="text-background-0"
                      variant="solid"
                      action="negative"
                      className="rounded-full h-[40] w-[40] p-0"
                      confirmTitle="Delete Group"
                      confirmDescription=" Deleting this group will remove all associated expenses and
            payments. Are you sure you want to proceed?"
                      isLoading={deleting}
                      isDelete
                      onConfirm={() => {
                        rowMap[item.id]?.closeRow();
                        handleDeleteGroup(item.id);
                      }}
                    />
                  </HStack>
                )
              }
              rightOpenValue={-116}
              disableRightSwipe
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
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
                      No groups joined or created yet. Create a group by
                      clicking the button below.
                    </Text>
                  </VStack>
                );
              }}
              ListFooterComponent={() => <Box className="h-16" />}
              stickyHeaderIndices={[0]}
            />
          </LoadingWrapper>
        </ScrollView>
      </TabLayout>
    </Fragment>
  );
}
