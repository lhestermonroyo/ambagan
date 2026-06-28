import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import SearchInput from "@/components/SearchInput";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { CheckboxGroup } from "@/components/ui/checkbox";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useFavoriteToggle } from "@/features/group/hooks/useFavoriteToggle";
import { useNetwork } from "@/hooks/useNetwork";
import services from "@/services";
import states from "@/states";
import { UserPreview } from "@/types/user";
import { filterContacts, getSavedContacts } from "@/utils/offlineContacts";
import { addRecentUser, addRecentUsers, getRecentUsers } from "@/utils/recentUsers";
import { Fragment, useEffect, useMemo, useState } from "react";
import RecentFavoritesTab from "./RecentFavoritesTab";
import SelectedMemberItem from "./SelectedMemberItem";
import { UserCheckboxItem } from "./UserCheckboxItem";

export default function MembersSelectionSheet({
  isOpen,
  onClose,
  members,
  onSaveMembers
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

  const user = states.user();
  const { details: userDetails } = user;
  const { isOnline } = useNetwork();

  const { favoriteIds, favoriteUsers, loadFavorites, handleToggleFavorite } =
    useFavoriteToggle(userDetails?.id);

  useEffect(() => {
    setSelected(members);
  }, [members]);

  useEffect(() => {
    if (isOpen && userDetails?.id) {
      loadFavorites();
      loadRecentUsers();
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
    if (searching) return users;
    return tab === "favorites" ? favoriteUsers : recentUsers;
  }, [searching, tab, users, favoriteUsers, recentUsers]);


  const handleChangeMembers = (newSelectedIds: (string | number)[]) => {
    const selectedUsers = displayUsers.filter((u) =>
      newSelectedIds.includes(u.id)
    );
    const currentIds = selected.map((m) => m.id);
    const newlyAdded = selectedUsers.filter((u) => !currentIds.includes(u.id));
    newlyAdded.forEach((u) => addRecentUser(u, userDetails!.id));

    setSelected((prev) => {
      const newMembers = selectedUsers.filter(
        (u) => !prev.some((m) => m.id === u.id)
      );
      const removedMembers = prev.filter(
        (m) => !newSelectedIds.includes(m.id) && m.id !== userDetails?.id
      );
      return [
        ...newMembers,
        ...prev.filter((m) => !removedMembers.some((r) => r.id === m.id))
      ];
    });
  };

  const handleRemoveMember = (id: string) => {
    setSelected((prev) => prev.filter((member) => member.id !== id));
  };

  const handleRemoveAllMembers = () => {
    setSelected((prev) =>
      prev.filter((member) => member.id === userDetails?.id)
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

  return (
    <Fragment>
      <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[90]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full gap-y-4 py-4">
            <VStack>
              <HStack className="px-4">
                <Text className="text-sm text-secondary-950 flex-1">
                  {selected.length} member
                  {selected.length > 1 ? "s" : ""} selected
                </Text>
                <Pressable
                  onPress={handleRemoveAllMembers}
                  disabled={
                    selected.includes(
                      selected.find((m) => m.id === user.details?.id)!
                    ) && selected.length === 1
                  }
                >
                  <Text className="text-primary-400">Remove All</Text>
                </Pressable>
              </HStack>
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
            </VStack>
            <Box className="px-4">
              <SearchInput
                placeholder="Search users to add or remove"
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
            {!searching && (
              <RecentFavoritesTab tab={tab} onTabChange={setTab} />
            )}
          </VStack>
          <ScrollView className="flex-1 w-full">
            {displayUsers.length === 0 && (
              <VStack className="p-4 justify-center items-center">
                <Text className="text-sm text-secondary-950">{emptyText}</Text>
              </VStack>
            )}
            <CheckboxGroup
              className="w-full"
              value={selected.map((member) => member.id)}
              onChange={handleChangeMembers}
            >
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
                      isFavorite={favoriteIds.has(item.id)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  );
                }}
                ItemSeparatorComponent={ListDivider}
              />
            </CheckboxGroup>
          </ScrollView>
          <Box className="items-center justify-center p-4">
            <HStack className="gap-x-2">
              <FormButton
                className="flex-1"
                variant="outline"
                text="Cancel"
                onPress={handleClose}
              />
              <FormButton
                className="flex-1"
                text="Save Members"
                disabled={selected.length === 0}
                onPress={handleSaveMembers}
              />
            </HStack>
          </Box>
        </ActionsheetContent>
      </Actionsheet>
    </Fragment>
  );
}
