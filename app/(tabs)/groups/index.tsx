import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { Group } from "@/types/groups";
import { categories } from "@/utils/constants";
import formatDate from "@/utils/formatDate";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable } from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";

export default function GroupsScreen() {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const group = states.group.getState();
  const user = states.user.getState();
  const params = useLocalSearchParams();
  const needsRefetch = params.refetch === "true";

  const router = useRouter();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!group.groups.length || needsRefetch) {
          fetchGroup();
        }
      },
      [group.groups.length, needsRefetch]
    )
  );

  useEffect(() => {
    if (searchInput.length > 0) {
      setSearching(true);
    } else {
      setSearching(false);
    }
  }, [searchInput]);

  const fetchGroup = async () => {
    setLoading(true);

    try {
      const groups = await services.group.getGroupsByUserId(
        user.details?.id || ""
      );

      if (!groups) return;

      states.group.setState((prev) => ({
        ...prev,
        groups
      }));
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    if (searchInput.length === 0) {
      return group.groups;
    }

    return group.groups.filter((g) =>
      g.name.toLowerCase().includes(searchInput.toLowerCase())
    );
  }, [searchInput, group.groups]);

  return (
    <TabLayout
      title="Groups"
      actions={[
        <Button
          variant="link"
          className="rounded-full"
          onPress={() => router.push("/groups/create?isGroup=true")}
        >
          <Icon as="group-add" size={28} className="text-primary-400" />
        </Button>
      ]}
    >
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
          renderHiddenItem={({ item }) => (
            <HStack className="flex-1 justify-end items-center flex-row px-4 gap-x-2 bg-background-50">
              <Button
                variant="solid"
                className="rounded-full h-[40] w-[40] p-0"
                onPress={() => router.push(`/groups/${item.id}/edit`)}
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
                <VStack className="flex-1 justify-center items-center py-4">
                  <Text className="text-secondary-950">
                    No results found on your search.
                  </Text>
                </VStack>
              );
            }

            return (
              <VStack className="flex-1 justify-center items-center gap-y-4 py-4">
                <Text className="text-secondary-950">
                  You have no groups yet.
                </Text>
                <FormButton
                  text="Create your first group"
                  onPress={() => router.push("/groups/create")}
                />
              </VStack>
            );
          }}
          stickyHeaderIndices={[0]}
        />
      </LoadingWrapper>
    </TabLayout>
  );
}

function GroupItem({
  details,
  onOpen
}: {
  details: Group;
  onOpen: () => void;
}) {
  return (
    <Pressable className="p-4 bg-background-0" onPress={onOpen}>
      <HStack className="items-center gap-x-2">
        <AppAvatar name={details.name} uri={details.avatar || ""} />
        <VStack className="flex-1">
          <Text className="text-lg" numberOfLines={2} ellipsizeMode="tail">
            {details.name}
          </Text>
          <HStack className="gap-x-1 items-center">
            <Text className="text-secondary-950 text-sm">
              Joined {formatDate(details.created_at)}
            </Text>
            <Text>&bull;</Text>
            <Text className="text-xs self-start py-1 px-2 bg-primary-100 text-primary-800 rounded-full">
              {categories.find((cat) => cat.value === details?.category)?.label}
            </Text>
          </HStack>
        </VStack>
        <Icon as="chevron-right" className="text-secondary-950" />
      </HStack>
    </Pressable>
  );
}
