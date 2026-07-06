import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import KeyboardAvoidingSheet from "@/components/KeyboardAvoidingSheet";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import SearchInput from "@/components/SearchInput";
import { FriendListSkeleton } from "@/components/SkeletonLoader";
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
import { CONTACTS_IMPORT_ENABLED } from "@/constants/features";
import ContactPickerSheet from "@/features/group/components/ContactPickerSheet";
import { useFavoriteToggle } from "@/features/group/hooks/useFavoriteToggle";
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import { useNetworkHealth } from "@/hooks/useNetworkHealth";
import services from "@/services";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { Member } from "@/types/groups";
import { UserPreview } from "@/types/user";
import { getPrimaryHex } from "@/utils/getColorHex";
import { filterContacts, getSavedContacts } from "@/utils/offlineContacts";
import * as offlineQueue from "@/utils/offlineQueue";
import { normalizePhone } from "@/utils/phone";
import { addRecentUsers, getRecentUsers } from "@/utils/recentUsers";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { UserPlus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Platform, useColorScheme } from "react-native";
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
  const [contactPickerOpen, setContactPickerOpen] = useState(false);

  const { details: groupDetails, memberList } = states.group.getState();
  const { details: userDetails } = states.user();
  const colorScheme = useColorScheme() ?? "light";
  const { isOnline } = useNetwork();
  const { isDegraded } = useNetworkHealth();
  const showNetworkBanner = !isOnline || isDegraded;

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
    const base = searching
      ? users
      : tab === "favorites"
        ? favoriteUsers
        : recentUsers;
    // Hide anyone already selected (locked or unlocked) — they reappear here
    // only after being removed from the selected chips above.
    return base.filter(
      (u) =>
        !lockedMembers.some((m) => m.id === u.id) &&
        !members.some((m) => m.id === u.id)
    );
  }, [
    searching,
    tab,
    users,
    favoriteUsers,
    recentUsers,
    lockedMembers,
    members
  ]);

  const emptyText = searching
    ? "No results found on your search."
    : tab === "favorites"
      ? "No favorites added yet."
      : "No recent users.";

  const emptyType = searching
    ? EmptyType.SEARCH
    : tab === "favorites"
      ? EmptyType.FAVORITE
      : EmptyType.FRIEND;

  const handleChangeMembers = (selectedIds: (string | number)[]) => {
    // Additions only. displayUsers already excludes everyone selected (members +
    // lockedMembers), so a visible-and-checked row can only be a new add;
    // removals go through the selected chips (handleRemoveMember). We deliberately
    // don't derive removals from selectedIds — react-stately's controlled ref goes
    // stale on RN when `members` changes from outside the group (e.g. adding phone
    // contacts), which would wrongly drop entries on the next toggle.
    const newlyAdded = displayUsers
      .filter((user) => selectedIds.includes(user.id))
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
    if (newlyAdded.length === 0) return;

    setMembers((prev) => [
      ...prev,
      ...newlyAdded.filter((u) => !prev.some((m) => m.id === u.id))
    ]);
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

  const handleAddContacts = (contactMembers: UserPreview[]) => {
    setMembers((prev) => {
      const existing = new Set([...prev, ...lockedMembers].map((m) => m.id));
      return [
        ...prev,
        ...contactMembers.filter((m) => !existing.has(m.id))
      ] as Member[];
    });
  };

  // Hide from the contact picker anyone already on the group (locked or not),
  // or already a friend/favorite — matched by normalized phone. Users without a
  // phone (email-only accounts) can't collide with a contact, so they drop out.
  const excludePhones = useMemo(
    () =>
      [
        ...memberList,
        ...lockedMembers,
        ...members,
        ...recentUsers,
        ...favoriteUsers
      ]
        .map((m) => normalizePhone((m as any).phone))
        .filter((p): p is string => !!p),
    [memberList, lockedMembers, members, recentUsers, favoriteUsers]
  );

  const handleUpdateMembers = async () => {
    try {
      if (!groupDetails?.id) return;

      const online = await offlineQueue.isOnline();
      // Phone contacts need the placeholder RPC (online) to get real ids.
      if (!online && services.member.hasUnresolvedContacts(members)) {
        showToast({
          title: "You're offline",
          description:
            "Adding phone contacts as members needs an internet connection. Remove them or reconnect.",
          type: "error"
        });
        return;
      }

      setSubmitting(true);

      // Resolve picked phone contacts to real placeholder ids (online only).
      const resolvedMembers = online
        ? ((await services.member.resolveContactMembers(members)) as Member[])
        : members;

      const allMembers = lockedMembers.concat(resolvedMembers);

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

      const membersToSave = resolvedMembers.map(
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
      if (!online) {
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
    <>
      <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[100]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <KeyboardAvoidingSheet>
            {showNetworkBanner && (
              <Box
                className={Platform.OS === "android" ? "h-4" : "h-[2.2rem]"}
              />
            )}
            <VStack
              className={cn(
                "w-full flex-1",
                Platform.OS === "android" ? "pt-[3rem]" : "pt-[4.5rem]"
              )}
            >
              <HStack className="items-center justify-between w-full pt-4 px-4">
                <Pressable onPress={handleClose}>
                  <HStack className="items-center">
                    <Icon as="arrow-back-ios" className="text-secondary-950" />
                    <Text bold className="text-xl">
                      Edit Members
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
              <LoadingWrapper
                isLoading={loading}
                skeleton={<FriendListSkeleton />}
              >
                <VStack className="w-full gap-y-4 pb-4">
                  <VStack>
                    {formattedMembers.length > 0 && (
                      <HStack className="px-4 pt-4">
                        <Text className="text-sm text-secondary-950 flex-1">
                          {formattedMembers.length} member
                          {formattedMembers.length > 1 ? "s" : ""} selected
                        </Text>
                      </HStack>
                    )}

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

                    {formattedMembers.length > 0 && (
                      <VStack className="w-full px-4">
                        <Text className="text-sm text-secondary-950">
                          Members with a lock icon have pending expenses and
                          must settle all payments before they can be removed.
                        </Text>
                      </VStack>
                    )}
                  </VStack>
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
                  {!searching && (
                    <RecentFavoritesTab tab={tab} onTabChange={setTab} />
                  )}
                </VStack>
                <ScrollView className="flex-1 w-full">
                  {displayUsers.length === 0 && (
                    <EmptyList type={emptyType} content={emptyText} />
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
          </KeyboardAvoidingSheet>
        </ActionsheetContent>
      </Actionsheet>

      <ContactPickerSheet
        isOpen={contactPickerOpen}
        onClose={() => setContactPickerOpen(false)}
        excludePhones={excludePhones}
        knownUsers={[
          ...recentUsers,
          ...favoriteUsers,
          ...memberList,
          ...lockedMembers,
          ...members
        ]}
        onAdd={handleAddContacts}
      />
    </>
  );
}
