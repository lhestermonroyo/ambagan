import AppSheet from "@/components/AppSheet";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import { FriendListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { CONTACTS_IMPORT_ENABLED } from "@/constants/features";
import ContactPickerSheet from "@/features/group/components/ContactPickerSheet";
import { useFavoriteToggle } from "@/features/group/hooks/useFavoriteToggle";
import { useNetwork } from "@/hooks/useNetwork";
import { useNetworkHealth } from "@/hooks/useNetworkHealth";
import services from "@/services";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { UserPreview } from "@/types/user";
import { getPrimaryHex } from "@/utils/getColorHex";
import { filterContacts, getSavedContacts } from "@/utils/offlineContacts";
import { normalizePhone } from "@/utils/phone";
import {
  addRecentUser,
  addRecentUsers,
  getRecentUsers,
} from "@/utils/recentUsers";
import { UserPlus } from "lucide-react-native";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Platform, useColorScheme } from "react-native";
import RecentFavoritesTab from "./RecentFavoritesTab";
import SelectedMemberItem from "./SelectedMemberItem";
import { UserCheckboxItem } from "./UserCheckboxItem";

export default function MembersSelectionSheet({
  isOpen,
  onClose,
  members,
  onSaveMembers,
}: {
  isOpen: boolean;
  onClose: () => void;
  members: UserPreview[];
  onSaveMembers: (members: UserPreview[]) => void;
}) {
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [tab, setTab] = useState<"friends" | "favorites">("friends");
  const [selected, setSelected] = useState<UserPreview[]>([]);
  const [users, setUsers] = useState<UserPreview[]>([]);
  const [recentUsers, setRecentUsers] = useState<UserPreview[]>([]);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const user = states.user();
  const { details: userDetails } = user;
  const { isOnline } = useNetwork();
  const { isDegraded } = useNetworkHealth();
  const showNetworkBanner = !isOnline || isDegraded;
  const colorScheme = useColorScheme() ?? "light";

  const { favoriteIds, favoriteUsers, loadFavorites, handleToggleFavorite } =
    useFavoriteToggle(userDetails?.id);

  useEffect(() => {
    setSelected(members);
  }, [members]);

  useEffect(() => {
    if (isOpen && userDetails?.id) {
      setLoading(true);
      Promise.all([loadFavorites(), loadRecentUsers()]).finally(() =>
        setLoading(false),
      );
    }
  }, [isOpen]);

  useEffect(() => {
    fetchUsers();
  }, [searchInput, isOnline]);

  const loadRecentUsers = async () => {
    try {
      const recent = await getRecentUsers(userDetails!.id);
      setRecentUsers(recent.filter((u) => u.id !== userDetails?.id));
    } catch (error) {
      console.error("Error loading recent users:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      if (!searching) {
        setUsers([]);
        return;
      }
      // Offline → filter the cached friends/favorites/recents pool; no DB search.
      if (!isOnline) {
        const contacts = await getSavedContacts(userDetails!.id);
        setUsers(filterContacts(contacts, searchInput));
        return;
      }
      const data = await services.user.searchUsers(searchInput);
      setUsers(data.filter((u) => u.id !== userDetails?.id));
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const displayUsers = useMemo(() => {
    return searching
      ? users
      : tab === "favorites"
        ? favoriteUsers
        : recentUsers;
  }, [searching, tab, users, favoriteUsers, recentUsers]);

  const handleToggleMember = (member: UserPreview) => {
    // Toggle against the current selection (our single source of truth). Selected
    // users stay visible and checked in the list; tapping a checked row removes
    // them. The selected chips above are just another entry point to `setSelected`.
    setSelected((prev) => {
      if (prev.some((m) => m.id === member.id)) {
        return prev.filter((m) => m.id !== member.id);
      }
      addRecentUser(member, userDetails!.id);
      return [...prev, member];
    });
  };

  const handleRemoveMember = (id: string) => {
    setSelected((prev) => prev.filter((member) => member.id !== id));
  };

  const handleAddContacts = (contactMembers: UserPreview[]) => {
    setSelected((prev) => {
      const existing = new Set(prev.map((m) => m.id));
      return [...prev, ...contactMembers.filter((m) => !existing.has(m.id))];
    });
  };

  // Hide from the contact picker anyone already selected, or already a
  // friend/favorite — matched by normalized phone. Users without a phone
  // (email-only accounts) simply can't collide with a contact, so they drop out.
  const excludePhones = useMemo(
    () =>
      [...selected, ...recentUsers, ...favoriteUsers]
        .map((m) => normalizePhone(m.phone))
        .filter((p): p is string => !!p),
    [selected, recentUsers, favoriteUsers],
  );

  const handleRemoveAllMembers = () => {
    setSelected((prev) =>
      prev.filter((member) => member.id === userDetails?.id),
    );
  };

  const handleClearStates = () => {
    setTab("friends");
    setSearchInput("");
    setSearching(false);
  };

  const handleSaveMembers = () => {
    const others = selected.filter((m) => m.id !== userDetails?.id);
    if (others.length > 0) {
      addRecentUsers(others, userDetails!.id);
    }
    onSaveMembers(selected);
    handleClearStates();
    onClose();
  };

  const handleClose = () => {
    handleClearStates();
    onClose();
  };

  const emptyText = searching
    ? "No results found on your search."
    : tab === "favorites"
      ? "No favorites added yet."
      : "No friends yet. Add members to a group to see them here.";

  const emptyType = searching
    ? EmptyType.SEARCH
    : tab === "favorites"
      ? EmptyType.FAVORITE
      : EmptyType.FRIEND;

  return (
    <Fragment>
      <AppSheet
        isOpen={isOpen}
        onClose={handleClose}
        fullscreen
        footer={
          <Box className="items-center justify-center p-4">
            <HStack className="gap-x-2">
              <FormButton
                className="flex-1"
                text="Save Members"
                disabled={selected.length === 0}
                onPress={handleSaveMembers}
              />
            </HStack>
          </Box>
        }
      >
        {showNetworkBanner && (
          <Box className={Platform.OS === "android" ? "h-4" : "h-[2.2rem]"} />
        )}
        <HStack className="items-center justify-between w-full pt-4 px-4">
          <Pressable onPress={handleClose}>
            <HStack className="items-center">
              <Icon as="arrow-back-ios" className="text-secondary-950" />
              <Text bold className="text-xl">
                Add Members
              </Text>
            </HStack>
          </Pressable>
          {CONTACTS_IMPORT_ENABLED && isOnline && (
            <FormButton
              variant="link"
              size="md"
              text="Add from Contacts"
              icon={
                <UserPlus
                  size={18}
                  color={getPrimaryHex("text-primary-400", colorScheme)}
                />
              }
              onPress={() => setContactPickerOpen(true)}
            />
          )}
        </HStack>
        <VStack className="w-full gap-y-4 pb-4">
          {selected.length > 0 && (
            <HStack className="px-4 pt-4">
              <Text className="text-sm text-secondary-950 flex-1">
                {selected.length} member
                {selected.length > 1 ? "s" : ""} selected
              </Text>
              <Pressable
                onPress={handleRemoveAllMembers}
                disabled={
                  selected.includes(
                    selected.find((m) => m.id === user.details?.id)!,
                  ) && selected.length === 1
                }
              >
                <Text className="text-primary-400">Remove All</Text>
              </Pressable>
            </HStack>
          )}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            className="w-full px-4"
            data={selected}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => {
              const isCreator = item.id === userDetails?.id;
              return (
                <SelectedMemberItem
                  key={item.id}
                  member={item}
                  disabled={isCreator}
                  onRemoveMember={() => handleRemoveMember(item.id)}
                />
              );
            }}
          />
          <Box className="px-4">
            <SearchInput
              placeholder="Search users"
              value={searchInput}
              onChangeText={(val) => setSearchInput(val)}
              onSetSearching={setSearching}
            />
          </Box>

          {!isOnline && (
            <Box className="px-4">
              <Text className="text-xs text-secondary-950">
                You're offline — showing saved contacts only
              </Text>
            </Box>
          )}
          {!searching && <RecentFavoritesTab tab={tab} onTabChange={setTab} />}
        </VStack>
        <ScrollView className="flex-1 w-full">
          <LoadingWrapper isLoading={loading} skeleton={<FriendListSkeleton />}>
            {displayUsers.length === 0 && (
              <EmptyList type={emptyType} content={emptyText} />
            )}
            <FlatList
              scrollEnabled={false}
              className="flex-1"
              data={displayUsers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const isCreator = item.id === userDetails?.id;
                return (
                  <UserCheckboxItem
                    key={item.id}
                    item={item}
                    disabled={isCreator}
                    isChecked={selected.some((m) => m.id === item.id)}
                    isFavorite={favoriteIds.has(item.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onToggle={handleToggleMember}
                  />
                );
              }}
              ItemSeparatorComponent={ListDivider}
            />
          </LoadingWrapper>
        </ScrollView>
      </AppSheet>

      <ContactPickerSheet
        isOpen={contactPickerOpen}
        onClose={() => setContactPickerOpen(false)}
        excludePhones={excludePhones}
        knownUsers={[...recentUsers, ...favoriteUsers]}
        onAdd={handleAddContacts}
      />
    </Fragment>
  );
}
