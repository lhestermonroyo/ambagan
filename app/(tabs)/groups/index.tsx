import { useEmptyStatePreview } from "@/hooks/useEmptyStatePreview";
import ConfirmIconButton from "@/components/ConfirmIconButton";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchDrawer from "@/components/SearchDrawer";
import {
  ContainerTabsSkeleton,
  FilterBarSkeleton,
  GroupListSkeleton
} from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import GroupItem from "@/features/group/components/GroupItem";
import GroupListFilterSheet, { groupFilterLabel } from "@/features/group/components/GroupListFilterSheet";
import { sortGroupsByActivity } from "@/features/group/utils/groupActivity";
import { groupEntryHref, groupEntryKey, isIndividualGroup } from "@/features/group/utils/groupMode";
import type { GroupFilter } from "@/features/group/services/group.service";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { GroupMode, type Group, type Member } from "@/types/groups";
import { getPrimaryHex, getOnOutlineHex } from "@/utils/getColorHex";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Archive,
  ArchiveRestore,
  BookPlus,
  ChevronDown,
  HousePlus,
  LayoutList,
  Plus,
  QrCode,
  Search,
  X
} from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { createRefreshGate, dataRevision, invalidateData } from "@/utils/dataRefresh";
import { Modal, RefreshControl, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SwipeListView } from "react-native-swipe-list-view";

const TABS = [
  { key: GroupMode.GROUP, label: "Groups" },
  { key: GroupMode.INDIVIDUAL, label: "Individual" }
];

type Entry = Group & { members: Member[] };
type TabPage = { entries: Entry[]; page: number; hasMore: boolean };
const initialFilters: Record<GroupMode, GroupFilter> = {
  [GroupMode.GROUP]: "all",
  [GroupMode.INDIVIDUAL]: "all"
};

export default function GroupsScreen() {
  const previewEmpty = useEmptyStatePreview();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchEntries, setSearchEntries] = useState<Entry[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [groups, setGroups] = useState<Entry[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<GroupMode>(GroupMode.GROUP);
  const [filters, setFilters] = useState(initialFilters);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const activeFilter = filters[activeTab];
  const [fabOpen, setFabOpen] = useState(false);

  const activeTabRef = useRef<GroupMode>(GroupMode.GROUP);
  const filtersRef = useRef(initialFilters);
  const requestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);
  const tabPages = useRef(new Map<string, TabPage>());
  const tabRequests = useRef(new Map<string, number>());
  const refreshGate = useRef(createRefreshGate()).current;
  const preloadingRef = useRef(true);

  const { details: userDetails } = states.user();

  const router = useRouter();
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();
  const colorScheme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id) return;
        init();
      },
      [userDetails?.id]
    )
  );

  const tabKey = (mode: GroupMode, filter: GroupFilter) =>
    `${userDetails?.id}:${mode}:${filter}`;

  const applyPage = (value: TabPage) => {
    setGroups(value.entries);
    setPage(value.page);
    setHasMore(value.hasMore);
  };

  const init = async () => {
    // Both tabs keep their own pages; switching tabs does not discard a list.
    try {
      await Promise.all(TABS.map(({ key }) =>
        fetchGroup(0, filtersRef.current[key], tabPages.current.has(tabKey(key, filtersRef.current[key])), key)
      ));
    } finally {
      preloadingRef.current = false;
      setLoading(false);
    }
  };

  const fetchGroup = (
    pageNum: number,
    filter: GroupFilter,
    isInitialized = false,
    mode = activeTabRef.current,
    force = false
  ): Promise<void> => {
    if (!userDetails?.id) return Promise.resolve();
    const key = tabKey(mode, filter);
    const load = async () => {
      const requestId = pageNum === 0
        ? (tabRequests.current.get(key) ?? 0) + 1
        : tabRequests.current.get(key) ?? 0;
      tabRequests.current.set(key, requestId);
      const isCurrent = () => mode === activeTabRef.current && filter === filtersRef.current[mode];
      if (pageNum === 0 && isCurrent()) setLoadingMore(false);
      if (!isInitialized && isCurrent()) setLoading(true);
      try {
        const result = await services.group.getGroupEntriesByUserIdPaginated(
          userDetails.id, pageNum, filter, mode
        );
        if (requestId !== tabRequests.current.get(key)) return;
        const previous = tabPages.current.get(key)?.entries ?? [];
        const entries = pageNum === 0 ? result.data :
          [...new Map([...previous, ...result.data].map(entry => [groupEntryKey(entry), entry])).values()];
        const value = { entries, page: pageNum, hasMore: result.hasNext };
        tabPages.current.set(key, value);
        if (isCurrent()) applyPage(value);
        if (filter === "all") {
          states.group.setState((prev) => ({
            ...prev,
            list: sortGroupsByActivity([...new Map([
              ...(pageNum === 0 && !result.hasNext
                ? prev.list.filter(entry => (entry.mode ?? GroupMode.GROUP) !== mode)
                : prev.list),
              ...result.data
            ].map(entry => [groupEntryKey(entry), entry])).values()]),
            initialized: true
          }));
        }
      } catch (error) {
        console.error("Failed to fetch groups:", error);
        throw error;
      } finally {
        if (!preloadingRef.current && requestId === tabRequests.current.get(key) && isCurrent()) setLoading(false);
      }
    };
    return (pageNum === 0
      ? refreshGate.run(key, dataRevision("groups"), load, force)
      : load()).catch(() => {});
  };

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    try {
      await fetchGroup(page + 1, filtersRef.current[activeTabRef.current], true);
    } finally {
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  };

  const showTab = async (mode: GroupMode, filter: GroupFilter) => {
    requestIdRef.current += 1;
    const cached = tabPages.current.get(tabKey(mode, filter));
    setLoadingMore(false);
    if (cached) {
      applyPage(cached);
      setLoading(false);
    } else {
      setGroups([]);
      setPage(0);
      setHasMore(false);
      setLoading(true);
    }
    await fetchGroup(0, filter, !!cached, mode);
  };

  const handleTabChange = async (tab: GroupMode) => {
    if (tab === activeTabRef.current) return;
    activeTabRef.current = tab;
    setActiveTab(tab);
    setFilterSheetOpen(false);
    await showTab(tab, filtersRef.current[tab]);
  };

  const handleFilterChange = async (filter: GroupFilter) => {
    const mode = activeTabRef.current;
    if (filter === filtersRef.current[mode]) return;
    filtersRef.current = { ...filtersRef.current, [mode]: filter };
    setFilters(filtersRef.current);
    await showTab(mode, filter);
  };

  const handleArchiveGroup = async (entry: Group) => {
    const groupId = entry.id;
    setArchiving(true);
    try {
      await (isIndividualGroup(entry) ? services.book.archiveBook(groupId) : services.group.archiveGroup(groupId));
      toast({
        title: isIndividualGroup(entry) ? "Individual Archived" : "Group Archived",
        description: "You can find it using the Archived filter.",
        type: "success"
      });
      await fetchGroup(0, filtersRef.current[activeTabRef.current], true, activeTabRef.current, true);
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

  const handleDeleteGroup = async (entry: Group) => {
    const groupId = entry.id;
    setDeleting(true);
    try {
      await (isIndividualGroup(entry) ? services.book.deleteBook(groupId) : services.group.deleteGroup(groupId));
      toast({
        title: isIndividualGroup(entry) ? "Individual Deleted" : "Group Deleted",
        description: "The group has been permanently deleted.",
        type: "success"
      });
      for (const [key, value] of tabPages.current) {
        tabPages.current.set(key, { ...value, entries: value.entries.filter((g) => groupEntryKey(g) !== groupEntryKey(entry)) });
      }
      setGroups((prev) => prev.filter((g) => groupEntryKey(g) !== groupEntryKey(entry)));
      states.group.setState((prev) => ({
        ...prev,
        list: prev.list.filter((g) => groupEntryKey(g) !== groupEntryKey(entry))
      }));
    } catch (error: any) {
      console.error("Failed to delete group:", error);
      toast({
        title: "Cannot Delete Group",
        description:
          error?.message ?? "Failed to delete group. Please try again.",
        type: "error"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleUnarchiveGroup = async (entry: Group) => {
    const groupId = entry.id;
    setArchiving(true);
    try {
      await (isIndividualGroup(entry) ? services.book.unarchiveBook(groupId) : services.group.unarchiveGroup(groupId));
      toast({
        title: "Group Restored",
        description: "Group has been moved back to your active groups.",
        type: "success"
      });
      await fetchGroup(0, filtersRef.current[activeTabRef.current], true, activeTabRef.current, true);
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
    invalidateData("groups");
    await fetchGroup(0, filtersRef.current[activeTabRef.current], true, activeTabRef.current, true);
    setRefreshing(false);
  };

  const handleCreateGroup = () => {
    setFabOpen(false);
    router.push("/groups/create");
  };

  const handleScanToJoin = async () => {
    setFabOpen(false);
    if (
      !(await ensureOnline(
        "You need an internet connection to scan and join a group. Please try again when you're back online."
      ))
    ) {
      return;
    }
    router.push("/scan" as any);
  };

  const fetchSearchEntries = async () => {
    if (!userDetails?.id) return;
    const userId = userDetails.id;
    const requestId = ++searchRequestIdRef.current;
    const filter = filtersRef.current[activeTabRef.current] === "archived" ? "archived" : "all";
    setSearchEntries([]);
    setSearchLoading(true);
    setSearchError(false);
    try {
      const entries: Entry[] = [];
      let searchPage = 0;
      let hasNext = true;
      while (hasNext) {
        // Omitting mode searches both ledgers, independently of the selected tab.
        const result = await services.group.getGroupEntriesByUserIdPaginated(userId, searchPage++, filter);
        if (requestId !== searchRequestIdRef.current || states.user.getState().details?.id !== userId) return;
        entries.push(...result.data);
        hasNext = result.hasNext;
      }
      setSearchEntries(sortGroupsByActivity(
        [...new Map(entries.map(entry => [groupEntryKey(entry), entry])).values()]
      ));
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) return;
      console.error("Failed to search entries:", error);
      setSearchError(true);
    } finally {
      if (requestId === searchRequestIdRef.current) setSearchLoading(false);
    }
  };

  const openSearch = () => {
    if (!userDetails?.id) return;
    setSearchVisible(true);
    fetchSearchEntries();
  };

  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    setSearching(text.trim().length > 0);
  };

  const closeSearch = () => {
    setSearchVisible(false);
    searchRequestIdRef.current += 1;
    setSearchLoading(false);
  };

  const handleCancelSearch = () => {
    setSearchInput("");
    setSearching(false);
    closeSearch();
  };

  const searchResults = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    return searchEntries.filter(entry => entry.name.toLowerCase().includes(query));
  }, [searchInput, searchEntries]);

  return (
    <TabLayout
      title="Groups"
      actions={[
        {
          key: "search",
          sf: "magnifyingglass",
          lucide: Search,
          label: "Search Groups and Individual",
          // The dim backdrop can't cover the native header, so guard here:
          // while the add menu is open, a search tap just dismisses it.
          onPress: () => {
            if (fabOpen) {
              setFabOpen(false);
              return;
            }
            openSearch();
          }
        },
        {
          key: "add",
          sf: fabOpen ? "xmark" : "plus",
          lucide: fabOpen ? X : Plus,
          label: fabOpen ? "Close Add Menu" : "Add Group",
          onPress: () => setFabOpen((prev) => !prev)
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
          <LoadingWrapper
            isLoading={loading}
            skeleton={
              <VStack className="pb-4 gap-y-4 pt-2">
                <ContainerTabsSkeleton widths={[112, 112]} fill />
                <FilterBarSkeleton />
              </VStack>
            }
          >
            <VStack className="bg-background-0 pb-4 gap-y-4 pt-2">
              <HStack className="gap-x-2 px-4">
                {TABS.map((tab) => (
                  <FormButton
                    key={tab.key}
                    size="sm"
                    className="flex-1"
                    variant={activeTab === tab.key ? "solid" : "outline"}
                    text={tab.label}
                    onPress={() => handleTabChange(tab.key)}
                  />
                ))}
              </HStack>
              <HStack className="px-4 items-center">
                <FormButton
                  size="sm"
                  variant="outline"
                  text={groupFilterLabel(activeFilter)}
                  iconEnd={
                    <ChevronDown
                      size={16}
                      color={getOnOutlineHex(colorScheme)}
                    />
                  }
                  onPress={() => setFilterSheetOpen(true)}
                />
              </HStack>
            </VStack>
          </LoadingWrapper>

          <LoadingWrapper isLoading={loading} skeleton={<GroupListSkeleton />}>
            <SwipeListView
              className="flex-1"
              scrollEnabled={false}
              data={previewEmpty ? [] : groups}
              keyExtractor={groupEntryKey}
              renderItem={({ item }) => (
                <GroupItem
                  details={item}
                  onOpen={() => router.push(groupEntryHref(item))}
                  key={groupEntryKey(item)}
                />
              )}
              renderHiddenItem={({ item }, rowMap) =>
                item.admin.id === userDetails?.id && (
                  <HStack className="flex-1 justify-end items-center flex-row px-4 gap-x-2 bg-background-50">
                    {activeFilter === "archived" ? (
                      <>
                        <ConfirmIconButton
                          icon="unarchive"
                          confirmIcon={ArchiveRestore}
                          iconClassName="text-background-0 dark:text-white"
                          variant="solid"
                          className="rounded-full h-[40] w-[40] p-0"
                          confirmTitle={
                            isIndividualGroup(item)
                              ? "Restore Individual"
                              : "Restore Group"
                          }
                          confirmDescription="This will move the group back to your active groups."
                          isLoading={archiving}
                          onConfirm={() => {
                            rowMap[groupEntryKey(item)]?.closeRow();
                            handleUnarchiveGroup(item);
                          }}
                        />
                        <ConfirmIconButton
                          icon="delete"
                          iconClassName="text-background-0 dark:text-white"
                          variant="solid"
                          action="negative"
                          className="rounded-full h-[40] w-[40] p-0"
                          confirmTitle={
                            isIndividualGroup(item)
                              ? "Delete Individual"
                              : "Delete Group"
                          }
                          confirmDescription={
                            isIndividualGroup(item)
                              ? "Permanently deleting this Individual entry removes its expenses and recurring schedules. This cannot be undone."
                              : "Permanently deleting this group will remove all expenses, settlements, and member data. This cannot be undone."
                          }
                          isDelete
                          isLoading={deleting}
                          onConfirm={() => {
                            rowMap[groupEntryKey(item)]?.closeRow();
                            handleDeleteGroup(item);
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          variant="solid"
                          className="rounded-full h-[40] w-[40] p-0"
                          onPress={() => {
                            router.push(
                              isIndividualGroup(item)
                                ? `/books/create?bookId=${item.id}`
                                : `/groups/${item.id}/edit?isGroup=true`
                            );
                            rowMap[groupEntryKey(item)]?.closeRow();
                          }}
                        >
                          <Icon
                            as="edit"
                            className="text-background-0 dark:text-white"
                          />
                        </Button>
                        <ConfirmIconButton
                          icon="archive"
                          confirmIcon={Archive}
                          iconClassName="text-background-0 dark:text-white"
                          variant="solid"
                          className="rounded-full h-[40] w-[40] p-0"
                          confirmTitle={
                            isIndividualGroup(item)
                              ? "Archive Individual"
                              : "Archive Group"
                          }
                          confirmDescription="This group will be archived and hidden from your active list. You can restore it anytime using the Archived filter."
                          isLoading={archiving}
                          onConfirm={() => {
                            rowMap[groupEntryKey(item)]?.closeRow();
                            handleArchiveGroup(item);
                          }}
                        />
                        <ConfirmIconButton
                          icon="delete"
                          iconClassName="text-background-0 dark:text-white"
                          variant="solid"
                          action="negative"
                          className="rounded-full h-[40] w-[40] p-0"
                          confirmTitle={
                            isIndividualGroup(item)
                              ? "Delete Individual"
                              : "Delete Group"
                          }
                          confirmDescription={
                            isIndividualGroup(item)
                              ? "Permanently deleting this Individual entry removes its expenses and recurring schedules. This cannot be undone."
                              : "Permanently deleting this group will remove all expenses, settlements, and member data. This cannot be undone."
                          }
                          isDelete
                          isLoading={deleting}
                          onConfirm={() => {
                            rowMap[groupEntryKey(item)]?.closeRow();
                            handleDeleteGroup(item);
                          }}
                        />
                      </>
                    )}
                  </HStack>
                )
              }
              rightOpenValue={activeFilter === "archived" ? -116 : -174}
              disableRightSwipe
              ItemSeparatorComponent={ListDivider}
              ListEmptyComponent={() => (
                <EmptyList
                  type={
                    activeTab === GroupMode.INDIVIDUAL
                      ? EmptyType.BOOK
                      : EmptyType.GROUP
                  }
                  actions={
                    activeFilter !== "all"
                      ? [
                          {
                            label: "View All",
                            icon: LayoutList,
                            onPress: () => handleFilterChange("all")
                          }
                        ]
                      : [
                          {
                            label:
                              activeTab === GroupMode.INDIVIDUAL
                                ? "Create Your First Individual"
                                : "Create Your First Group",
                            icon:
                              activeTab === GroupMode.INDIVIDUAL
                                ? BookPlus
                                : HousePlus,
                            onPress: () =>
                              router.push(
                                activeTab === GroupMode.INDIVIDUAL
                                  ? "/books/create"
                                  : "/groups/create"
                              )
                          },
                          ...(activeTab === GroupMode.GROUP
                            ? [
                                {
                                  label: "Scan to Join",
                                  icon: QrCode,
                                  onPress: handleScanToJoin
                                }
                              ]
                            : [])
                        ]
                  }
                  content={
                    activeTab === GroupMode.INDIVIDUAL
                      ? activeFilter === "archived"
                        ? "Archived Individual entries will appear here."
                        : "Track your own spending. Create your first Individual entry."
                      : activeFilter === "archived"
                        ? "Archived groups will appear here."
                        : activeFilter === "created"
                          ? "Groups you create will appear here."
                          : activeFilter === "joined"
                            ? "Groups you join will appear here."
                            : "Split bills with friends. Create a group or scan an invite to join."
                  }
                />
              )}
              ListFooterComponent={
                previewEmpty
                  ? null
                  : () => (
                      <>
                        {hasMore && (
                          <ListFooter
                            hasNextPage={hasMore}
                            loading={loadingMore}
                            onLoadMore={loadMore}
                          />
                        )}
                      </>
                    )
              }
            />
          </LoadingWrapper>
        </ScrollView>

        {/* Add-group speed-dial rendered in a Modal so its dim masks the WHOLE
            window — native header included — matching the group-details menu.
            The menu drops from just under the "+" header button (top-right),
            offset below the native header via the safe-area top inset. Backdrop
            and menu are siblings so a tap on the menu padding doesn't dismiss. */}
        <Modal
          visible={fabOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setFabOpen(false)}
        >
          <Pressable
            onPress={() => setFabOpen(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)"
            }}
          />
          <Box
            className="absolute right-4"
            style={{
              top: insets.top + 52,
              width: 240,
              borderRadius: 14,
              overflow: "hidden",
              backgroundColor: colorScheme === "dark" ? "#2C2C2E" : "#FFFFFF",
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8
            }}
          >
            <Pressable
              className="flex-row items-center justify-between px-4 py-3.5 active:opacity-60"
              onPress={handleCreateGroup}
            >
              <Text className="text-base">Create Group</Text>
              <HousePlus
                size={20}
                color={getPrimaryHex("text-primary-500", colorScheme)}
              />
            </Pressable>
            <Box
              style={{
                height: 0.5,
                backgroundColor: colorScheme === "dark" ? "#3A3A3C" : "#E5E5EA"
              }}
            />
            <Pressable
              className="flex-row items-center justify-between px-4 py-3.5 active:opacity-60"
              onPress={handleScanToJoin}
            >
              <Text className="text-base">Scan to Join</Text>
              <QrCode
                size={20}
                color={getPrimaryHex("text-primary-500", colorScheme)}
              />
            </Pressable>
          </Box>
        </Modal>

        <GroupListFilterSheet
          isOpen={filterSheetOpen && !loading}
          onClose={() => setFilterSheetOpen(false)}
          mode={activeTab}
          filter={activeFilter}
          onSelect={handleFilterChange}
        />

        <SearchDrawer
          isOpen={searchVisible}
          onClose={closeSearch}
          onCancel={handleCancelSearch}
          value={searchInput}
          onChangeText={handleSearchChange}
          placeholder="Search groups"
        >
          {searching ? (
            <VStack className="flex-1">
              <LoadingWrapper
                isLoading={searchLoading}
                skeleton={<GroupListSkeleton />}
              >
                {searchError ? (
                  <VStack className="p-4 gap-y-3 items-center">
                    <Text className="text-secondary-950">
                      Couldn't load search results.
                    </Text>
                    <FormButton
                      size="sm"
                      text="Try Again"
                      variant="outline"
                      onPress={fetchSearchEntries}
                    />
                  </VStack>
                ) : (
                  <FlatList
                    className="flex-1"
                    data={previewEmpty ? [] : searchResults}
                    keyExtractor={groupEntryKey}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 24 }}
                    renderItem={({ item }) => (
                      <GroupItem
                        details={item}
                        onOpen={() => {
                          handleCancelSearch();
                          router.push(groupEntryHref(item));
                        }}
                      />
                    )}
                    ItemSeparatorComponent={ListDivider}
                    ListHeaderComponent={
                      <Text
                        className="text-sm text-secondary-950 px-4 py-2"
                        bold
                      >
                        {previewEmpty ? 0 : searchResults.length} result
                        {previewEmpty || searchResults.length !== 1 ? "s" : ""}
                      </Text>
                    }
                    ListEmptyComponent={
                      <EmptyList
                        type={EmptyType.SEARCH}
                        actions={[
                          {
                            label: "Clear Search",
                            icon: X,
                            onPress: handleCancelSearch
                          }
                        ]}
                      />
                    }
                  />
                )}
              </LoadingWrapper>
            </VStack>
          ) : null}
        </SearchDrawer>
      </Box>
    </TabLayout>
  );
}
