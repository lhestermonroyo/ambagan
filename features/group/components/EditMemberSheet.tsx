import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent
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
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import services from "@/services";
import states from "@/states";
import { Member } from "@/types/groups";
import { UserPreview } from "@/types/user";
import { filterContacts, getSavedContacts } from "@/utils/offlineContacts";
import * as offlineQueue from "@/utils/offlineQueue";
import { addRecentUsers, getRecentUsers } from "@/utils/recentUsers";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import RecentFavoritesTab from "./RecentFavoritesTab";
import SelectedMemberItem from "./SelectedMemberItem";
import { UserCheckboxItem } from "./UserCheckboxItem";

export default function EditMembersSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [users, setUsers] = useState<UserPreview[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [lockedMembers, setLockedMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<"friends" | "favorites">("friends");
  const [recentUsers, setRecentUsers] = useState<UserPreview[]>([]);

  const { details: groupDetails, memberList } = states.group.getState();
  const { details: userDetails } = states.user();
  const { isOnline } = useNetwork();

  const {
    favoriteIds,
    favoriteUsers,
    loadFavorites,
    handleToggleFavorite,
    resetFavorites
  } = useFavoriteToggle(userDetails?.id);

  const showToast = useAppToast();

  useEffect(() => {
    if (isOpen && userDetails?.id) {
      init();
      loadRecentUsers();
      loadFavorites((u) => u.id !== groupDetails?.admin.id);
    }
  }, [isOpen]);

  useEffect(() => {
    fetchUsers();
  }, [searchInput, isOnline]);

  const init = async () => {
    setLoading(true);

    const locked: Member[] = [];
    const unlocked: Member[] = [];
    try {
      if (!groupDetails) return;

      await Promise.all(
        memberList
          .filter((member) => member.id !== groupDetails.admin.id)
          .map(async (member) => {
            const hasUnpaid = await services.expense.getUnpaidPayments(
              groupDetails.id,
              member.id
            );

            if (hasUnpaid) {
              locked.push(member);
            } else {
              unlocked.push(member);
            }
          })
      );

      setLockedMembers(locked);
      setMembers(unlocked);
    } catch (error) {
      console.log("Error fetching unpaid expenses:", error);
    } finally {
      setLoading(false);
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
        setUsers(
          filterContacts(contacts, searchInput).filter(
            (u) => u.id !== groupDetails?.admin.id
          )
        );
        return;
      }
      const data = await services.user.searchUsers(searchInput);
      const filteredUsers = data.filter((u) => u.id !== groupDetails?.admin.id);

      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const loadRecentUsers = async () => {
    try {
      const recent = await getRecentUsers(userDetails!.id);
      setRecentUsers(recent.filter((u) => u.id !== groupDetails?.admin.id));
    } catch (error) {
      console.error("Error loading recent users:", error);
    }
  };

  const displayUsers = useMemo(() => {
    if (searching) return users;
    return tab === "favorites" ? favoriteUsers : recentUsers;
  }, [searching, tab, users, favoriteUsers, recentUsers]);

  const handleChangeMembers = (selected: (string | number)[]) => {
    const selectedUnlocked = selected.filter(
      (id) => !lockedMembers.some((member) => member.id === id)
    );

    const selectedUsers = displayUsers
      .filter((user) => selectedUnlocked.includes(user.id))
      .map(
        (user) =>
          ({
            id: user.id,
            email: user.email,
            avatar: user.avatar,
            first_name: user.first_name,
            last_name: user.last_name
          }) as Member
      );
    const currentIds = members.map((m) => m.id);
    const newlyAdded = selectedUsers.filter((u) => !currentIds.includes(u.id));
    // intentionally not saving here — saved in bulk on submit

    setMembers((prev) => {
      const newMembers = selectedUsers.filter(
        (user) => !prev.some((member) => member.id === user.id)
      );
      const removedMembers = prev.filter(
        (member) =>
          !selectedUnlocked.includes(member.id) &&
          displayUsers.some((u) => u.id === member.id)
      );
      return [
        ...newMembers,
        ...prev.filter((m) => !removedMembers.some((r) => r.id === m.id))
      ];
    });
  };

  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((member) => member.id !== id));
  };

  const handleClearStates = () => {
    setTab("friends");
    setSearchInput("");
    setSearching(false);
    setUsers([]);
    setRecentUsers([]);
    resetFavorites();
  };

  const handleClose = () => {
    handleClearStates();
    onClose();
  };

  const handleUpdateMembers = async () => {
    try {
      if (!groupDetails?.id) return;
      setSubmitting(true);

      const allMembers = lockedMembers.concat(members);

      const membersToAdd = allMembers
        .filter((member) => !memberList.some((m) => m.id === member.id))
        .map((member) => member.id);
      const membersToRemove = memberList
        .filter(
          (member) =>
            member.id !== groupDetails.admin.id &&
            !allMembers.some((m) => m.id === member.id)
        )
        .map((member) => member.id);

      const membersToSave = members.map(
        (m) =>
          ({
            id: m.id,
            email: m.email,
            avatar: m.avatar,
            first_name: m.first_name,
            last_name: m.last_name,
            phone: ""
          }) as UserPreview
      );

      // Offline → queue the roster change with an optimistic update. The cached
      // member list is updated too, so an offline-added expense reflects the new
      // roster. Member editing is admin-only, so there's a single authorized
      // editor and no cross-user conflict.
      if (!(await offlineQueue.isOnline())) {
        const now = new Date().toISOString();
        const roster = allMembers.map(
          (m) =>
            ({
              id: m.id,
              email: (m as any).email ?? "",
              phone: (m as any).phone ?? "",
              first_name: m.first_name,
              last_name: m.last_name,
              avatar: m.avatar ?? null,
              joined_at: (m as any).joined_at ?? now,
              group_id: groupDetails.id
            }) as Member
        );

        await offlineQueue.queueUpdateMembers(
          groupDetails.id,
          membersToAdd,
          membersToRemove,
          roster
        );
        await addRecentUsers(membersToSave, userDetails!.id);

        showToast({
          title: "Saved offline",
          description:
            "Member changes will sync automatically when you're back online.",
          type: "info"
        });
        handleClose();
        return;
      }

      const response = await services.member.updateGroupMembers(
        groupDetails.id,
        membersToAdd,
        membersToRemove
      );

      states.group.setState((prev) => ({
        ...prev,
        memberList: response.data
      }));

      await addRecentUsers(membersToSave, userDetails!.id);

      showToast({
        title: "Success",
        description: "Group members updated successfully",
        type: "success"
      });
      handleClose();
    } catch (error) {
      console.error("Error updating group members:", error);
      showToast({
        title: "Error",
        description: "Failed to update group members",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formattedMembers = useMemo(() => {
    return lockedMembers.concat(members);
  }, [members, lockedMembers]);

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[100]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <VStack
          className={cn(
            "w-full flex-1",
            Platform.OS === "android" ? "pt-[3rem]" : "pt-[4.5rem]"
          )}
        >
          <Pressable onPress={handleClose}>
            <HStack className="p-4 items-center">
              <Icon as="arrow-back-ios" className="text-secondary-950" />
              <Text bold className="text-xl">
                Edit Members
              </Text>
            </HStack>
          </Pressable>
          <LoadingWrapper text="Loading members..." isLoading={loading}>
            <VStack className="w-full gap-y-4">
              <VStack>
                <HStack className="px-4">
                  <Text className="text-sm text-secondary-950 flex-1">
                    {formattedMembers.length} member
                    {formattedMembers.length > 1 ? "s" : ""} selected
                  </Text>
                </HStack>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="w-full px-4"
                  data={formattedMembers}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => {
                    const isCreator = item.id === userDetails?.id;
                    const isLocked = lockedMembers.some(
                      (member) => member.id === item.id
                    );

                    return (
                      <SelectedMemberItem
                        key={item.id}
                        member={item}
                        disabled={isCreator || isLocked}
                        onRemoveMember={() => handleRemoveMember(item.id)}
                      />
                    );
                  }}
                />
                <VStack className="w-full px-4">
                  <Text className="text-sm text-secondary-950">
                    Members with a lock icon have pending expenses and must
                    settle all payments before they can be removed.
                  </Text>
                </VStack>
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
                  <Text className="text-sm text-secondary-950">
                    {searching
                      ? "No results found on your search."
                      : tab === "favorites"
                        ? "No favorites added yet."
                        : "No recent users."}
                  </Text>
                </VStack>
              )}
              <CheckboxGroup
                className="w-full"
                value={formattedMembers.map((member) => member.id)}
                onChange={handleChangeMembers}
              >
                <FlatList
                  scrollEnabled={false}
                  className="flex-1"
                  data={displayUsers}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => {
                    const isLocked = lockedMembers.some(
                      (member) => member.id === item.id
                    );
                    const isCreator = item.id === userDetails?.id;

                    return (
                      <UserCheckboxItem
                        key={item.id}
                        item={item}
                        disabled={isCreator || isLocked}
                        isFavorite={favoriteIds.has(item.id)}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    );
                  }}
                  ItemSeparatorComponent={ListDivider}
                />
              </CheckboxGroup>
            </ScrollView>
          </LoadingWrapper>
        </VStack>
        <Box className="items-center justify-center p-4">
          <HStack className="gap-x-2">
            <FormButton
              className="flex-1"
              variant="outline"
              text="Cancel"
              disabled={submitting}
              onPress={handleClose}
            />
            <FormButton
              className="flex-1"
              text="Update Members"
              disabled={formattedMembers.length === 0 || submitting}
              loading={submitting}
              onPress={handleUpdateMembers}
            />
          </HStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
}
