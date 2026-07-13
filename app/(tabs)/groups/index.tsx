import ConfirmIconButton from "@/components/ConfirmIconButton";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchDrawer from "@/components/SearchDrawer";
import { GroupListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import GroupAddSheet from "@/features/group/components/GroupAddSheet";
import GroupItem from "@/features/group/components/GroupItem";
import { GroupFilter } from "@/features/group/services/group.service";
import useAppToast from "@/hooks/use-app-toast";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { useFocusEffect, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { RefreshControl } from "react-native";
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
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<GroupFilter>("all");
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const activeTabRef = useRef<GroupFilter>("all");

  const { details: userDetails } = states.user();

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
          list: pageNum === 0 ? result.data : [...prev.list, ...result.data],
          initialized: true
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
    setAddSheetOpen(false);
    router.push("/groups/create");
  };

  const handleScanToJoin = () => {
    setAddSheetOpen(false);
    router.push("/scan" as any);
  };

  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    setSearching(text.length > 0);
  };

  const handleCancelSearch = () => {
    setSearchInput("");
    setSearching(false);
    setSearchVisible(false);
  };

  const filteredGroups = useMemo(() => {
    if (searchInput.length === 0) return groups;
    return groups.filter((g) =>
      g.name.toLowerCase().includes(searchInput.toLowerCase())
    );
  }, [searchInput, groups]);

  return (
    <TabLayout
      title="Groups"
      actions={[
        {
          key: "search",
          sf: "magnifyingglass",
          label: "Search groups",
          onPress: () => setSearchVisible(true)
        },
        {
          key: "add",
          sf: "plus",
          label: "Add group",
          onPress: () => setAddSheetOpen(true)
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
                </>
              )}
            />
          </LoadingWrapper>
        </ScrollView>

        <GroupAddSheet
          isOpen={addSheetOpen}
          onClose={() => setAddSheetOpen(false)}
          onCreate={handleCreateGroup}
          onScan={handleScanToJoin}
        />

        <SearchDrawer
          isOpen={searchVisible}
          onClose={() => setSearchVisible(false)}
          onCancel={handleCancelSearch}
          value={searchInput}
          onChangeText={handleSearchChange}
          placeholder="Search groups"
        >
          {searching ? (
            <FlatList
              data={filteredGroups}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <GroupItem
                  details={item}
                  onOpen={() => {
                    handleCancelSearch();
                    router.push(`/groups/${item.id}`);
                  }}
                />
              )}
              ItemSeparatorComponent={ListDivider}
              ListHeaderComponent={
                <Text className="text-sm text-secondary-950 px-4 py-2" bold>
                  {filteredGroups.length} result
                  {filteredGroups.length !== 1 ? "s" : ""}
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
