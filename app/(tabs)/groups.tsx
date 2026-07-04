import ConfirmIconButton from "@/components/ConfirmIconButton";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import { GroupListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Fab, FabLabel } from "@/components/ui/fab";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import GroupItem from "@/features/group/components/GroupItem";
import { GroupFilter } from "@/features/group/services/group.service";
import useAppToast from "@/hooks/use-app-toast";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useFocusEffect, useRouter } from "expo-router";
import { HousePlus, QrCode, X } from "lucide-react-native";
import { Fragment, useMemo, useRef, useState } from "react";
import { RefreshControl, useColorScheme } from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";

const TABS: { key: GroupFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "created", label: "Created" },
  { key: "joined", label: "Joined" },
  { key: "archived", label: "Archived" }
];

export default function GroupsScreen() {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<GroupFilter>("all");
  const [fabOpen, setFabOpen] = useState(false);

  const activeTabRef = useRef<GroupFilter>("all");

  const { details: userDetails } = states.user();

  const colorScheme = useColorScheme() ?? "light";
  const router = useRouter();
  const toast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id) return;
        init(initialized, activeTabRef.current);
      },
      [userDetails?.id, initialized]
    )
  );

  const init = async (isInitialized = false, filter: GroupFilter = "all") => {
    await fetchGroup(0, filter, isInitialized);
    setInitialized(true);
  };

  const fetchGroup = async (
    pageNum: number,
    filter: GroupFilter,
    isInitialized = false
  ) => {
    if (!userDetails?.id) return;
    if (!isInitialized) setLoading(true);
    try {
      const result = await services.group.getGroupsByUserIdPaginated(
        userDetails.id,
        pageNum,
        filter
      );
      setGroups((prev) =>
        pageNum === 0 ? result.data : [...prev, ...result.data]
      );
      setPage(pageNum);
      setHasMore(result.hasNext);
      if (filter === "all") {
        states.group.setState((prev) => ({
          ...prev,
          list: pageNum === 0 ? result.data : [...prev.list, ...result.data]
        }));
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      if (!isInitialized) setLoading(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      await fetchGroup(page + 1, activeTabRef.current, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTabChange = async (tab: GroupFilter) => {
    if (tab === activeTabRef.current) return;
    activeTabRef.current = tab;
    setActiveTab(tab);
    setPage(0);
    setHasMore(false);
    await fetchGroup(0, tab, true);
  };

  const handleArchiveGroup = async (groupId: string) => {
    setArchiving(true);
    try {
      await services.group.archiveGroup(groupId);
      toast({
        title: "Group archived",
        description: "You can find it in the Archived tab.",
        type: "success"
      });
      await fetchGroup(0, activeTabRef.current, true);
    } catch (error) {
      console.error("Failed to archive group:", error);
      toast({
        title: "Error",
        description: "Failed to archive group. Please try again.",
        type: "error"
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    setDeleting(true);
    try {
      await services.group.deleteGroup(groupId);
      toast({
        title: "Group deleted",
        description: "The group has been permanently deleted.",
        type: "success"
      });
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      states.group.setState((prev) => ({
        ...prev,
        list: prev.list.filter((g) => g.id !== groupId)
      }));
    } catch (error: any) {
      console.error("Failed to delete group:", error);
      toast({
        title: "Cannot delete group",
        description:
          error?.message ?? "Failed to delete group. Please try again.",
        type: "error"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleUnarchiveGroup = async (groupId: string) => {
    setArchiving(true);
    try {
      await services.group.unarchiveGroup(groupId);
      toast({
        title: "Group restored",
        description: "Group has been moved back to your active groups.",
        type: "success"
      });
      await fetchGroup(0, activeTabRef.current, true);
    } catch (error) {
      console.error("Failed to unarchive group:", error);
      toast({
        title: "Error",
        description: "Failed to restore group. Please try again.",
        type: "error"
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGroup(0, activeTabRef.current, true);
    setRefreshing(false);
  };

  const handleCreateGroup = () => {
    setFabOpen(false);
    router.push("/groups/create");
  };

  const handleScanToJoin = () => {
    setFabOpen(false);
    router.push("/scan" as any);
  };

  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    setSearching(text.length > 0);
  };

  const filteredGroups = useMemo(() => {
    if (searchInput.length === 0) return groups;
    return groups.filter((g) =>
      g.name.toLowerCase().includes(searchInput.toLowerCase())
    );
  }, [searchInput, groups]);

  return (
    <Fragment>
      {fabOpen && (
        <Pressable
          className="absolute inset-0 z-40"
          onPress={() => setFabOpen(false)}
        />
      )}
      {fabOpen && (
        <VStack className="absolute bottom-20 right-4 z-50 gap-2 items-end">
          <Pressable className="rounded-full" onPress={handleScanToJoin}>
            {({ pressed }) => (
              <HStack
                className={cn(
                  pressed
                    ? "bg-background-50"
                    : "bg-white dark:bg-[#1F1F1F]",
                  "flex-row items-center gap-x-2 p-4 rounded-full shadow-sm"
                )}
              >
                <QrCode
                  size={18}
                  color={getPrimaryHex("text-primary-400", colorScheme)}
                />
                <Text className="font-semibold">Scan to Join</Text>
              </HStack>
            )}
          </Pressable>
          <Pressable className="rounded-full" onPress={handleCreateGroup}>
            {({ pressed }) => (
              <HStack
                className={cn(
                  pressed
                    ? "bg-background-50"
                    : "bg-white dark:bg-[#1F1F1F]",
                  "flex-row items-center gap-x-2 p-4 rounded-full shadow-sm"
                )}
              >
                <HousePlus
                  size={18}
                  color={getSecondaryHex("text-secondary-950", colorScheme)}
                />
                <Text className="font-semibold">Create Group</Text>
              </HStack>
            )}
          </Pressable>
        </VStack>
      )}
      <Fab
        placement="bottom right"
        className="px-6"
        isHovered={false}
        isDisabled={false}
        isPressed={false}
        onPress={() => setFabOpen((prev) => !prev)}
      >
        {fabOpen ? (
          <X
            size={18}
            color={getSecondaryHex("text-secondary-0", colorScheme)}
          />
        ) : (
          <HousePlus
            size={18}
            color={getSecondaryHex("text-secondary-0", colorScheme)}
          />
        )}
        <FabLabel className="text-lg font-medium">
          {fabOpen ? "Close" : "Add Group"}
        </FabLabel>
      </Fab>
      <TabLayout title="Groups">
        <VStack className="bg-background-0 pb-3 gap-y-3">
          <Box className="px-4">
            <SearchInput
              onChangeText={handleSearchChange}
              value={searchInput}
              placeholder="Search groups"
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
          <LoadingWrapper isLoading={loading} skeleton={<GroupListSkeleton />}>
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
              renderHiddenItem={({ item }, rowMap) =>
                item.admin.id === userDetails?.id && (
                  <HStack className="flex-1 justify-end items-center flex-row px-4 gap-x-2 bg-background-50">
                    {activeTab === "archived" ? (
                      <>
                        <ConfirmIconButton
                          icon="unarchive"
                          iconClassName="text-background-0"
                          variant="solid"
                          className="rounded-full h-[40] w-[40] p-0"
                          confirmTitle="Restore Group"
                          confirmDescription="This will move the group back to your active groups."
                          isLoading={archiving}
                          onConfirm={() => {
                            rowMap[item.id]?.closeRow();
                            handleUnarchiveGroup(item.id);
                          }}
                        />
                        <ConfirmIconButton
                          icon="delete"
                          iconClassName="text-background-0"
                          variant="solid"
                          action="negative"
                          className="rounded-full h-[40] w-[40] p-0"
                          confirmTitle="Delete Group"
                          confirmDescription="Permanently deleting this group will remove all expenses, settlements, and member data. This cannot be undone."
                          isDelete
                          isLoading={deleting}
                          onConfirm={() => {
                            rowMap[item.id]?.closeRow();
                            handleDeleteGroup(item.id);
                          }}
                        />
                      </>
                    ) : (
                      <>
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
                          icon="archive"
                          iconClassName="text-background-0"
                          variant="solid"
                          className="rounded-full h-[40] w-[40] p-0"
                          confirmTitle="Archive Group"
                          confirmDescription="This group will be archived and hidden from your active list. You can restore it anytime from the Archived tab."
                          isLoading={archiving}
                          onConfirm={() => {
                            rowMap[item.id]?.closeRow();
                            handleArchiveGroup(item.id);
                          }}
                        />
                        <ConfirmIconButton
                          icon="delete"
                          iconClassName="text-background-0"
                          variant="solid"
                          action="negative"
                          className="rounded-full h-[40] w-[40] p-0"
                          confirmTitle="Delete Group"
                          confirmDescription="Permanently deleting this group will remove all expenses, settlements, and member data. This cannot be undone."
                          isDelete
                          isLoading={deleting}
                          onConfirm={() => {
                            rowMap[item.id]?.closeRow();
                            handleDeleteGroup(item.id);
                          }}
                        />
                      </>
                    )}
                  </HStack>
                )
              }
              rightOpenValue={activeTab === "archived" ? -116 : -174}
              disableRightSwipe
              ItemSeparatorComponent={ListDivider}
              ListHeaderComponent={() =>
                searching && (
                  <Text className="text-sm text-secondary-950 px-4 pb-2" bold>
                    {filteredGroups.length} result
                    {filteredGroups.length !== 1 ? "s" : ""}
                  </Text>
                )
              }
              ListEmptyComponent={() => (
                <EmptyList
                  type={searching ? EmptyType.SEARCH : EmptyType.GROUP}
                />
              )}
              ListFooterComponent={() => (
                <>
                  {hasMore && (
                    <ListFooter
                      hasNextPage={hasMore}
                      loading={loadingMore}
                      onLoadMore={loadMore}
                    />
                  )}
                  <Box className="h-16" />
                </>
              )}
            />
          </LoadingWrapper>
        </ScrollView>
      </TabLayout>
    </Fragment>
  );
}
