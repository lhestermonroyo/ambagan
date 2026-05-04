import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
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
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Member } from "@/types/groups";
import { UserPreview } from "@/types/user";
import { useEffect, useMemo, useState } from "react";
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
  const [tab, setTab] = useState<"recent" | "favorites">("recent");

  const { details: groupDetails, memberList } = states.group.getState();
  const { details: userDetails } = states.user();

  const showToast = useAppToast();

  useEffect(() => {
    if (isOpen) {
      init();
    }
  }, [isOpen]);

  useEffect(() => {
    fetchUsers();
  }, [searchInput]);

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
      const data = await services.user.searchUsers(searchInput);
      const filteredUsers = data.filter((u) => u.id !== groupDetails?.admin.id);

      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleChangeMembers = (selected: (string | number)[]) => {
    const selectedUnlocked = selected.filter(
      (id) => !lockedMembers.some((member) => member.id === id)
    );

    const selectedUsers = users
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
    setMembers((prev) => {
      const newMembers = selectedUsers.filter(
        (user) => !prev.some((member) => member.id === user.id)
      );
      const removedMembers = prev.filter(
        (member) => !selected.includes(member.id)
      );
      return [
        ...newMembers,
        ...prev.filter((member) => !removedMembers.includes(member))
      ];
    });
  };

  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((member) => member.id !== id));
  };

  const handleClearStates = () => {
    setTab("recent");
    setSearchInput("");
    setSearching(false);
  };

  const handleClose = () => {
    handleClearStates();
    onClose();
  };

  const handleUpdateMembers = async () => {
    try {
      setSubmitting(true);

      if (!groupDetails?.id) return;

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

      const response = await services.member.updateGroupMembers(
        groupDetails.id,
        membersToAdd,
        membersToRemove
      );

      states.group.setState((prev) => ({
        ...prev,
        memberList: response.data
      }));

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
    <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[94]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <Box className="w-full flex-1">
          <LoadingWrapper text="Loading selected members" isLoading={loading}>
            <VStack className="w-full gap-y-4 py-4 bg-typography-0">
              <VStack>
                <HStack className="px-4">
                  <Text className="text-secondary-950 flex-1">
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
              <HStack className="gap-x-2 px-4">
                <FormButton
                  size="md"
                  variant={tab === "recent" ? "solid" : "outline"}
                  className="flex-1 h-10"
                  text="Recent"
                  onPress={() => setTab("recent")}
                />
                <FormButton
                  size="md"
                  variant={tab === "favorites" ? "solid" : "outline"}
                  className="flex-1 h-10"
                  text="Favorites"
                  onPress={() => setTab("favorites")}
                />
              </HStack>
            </VStack>
            <ScrollView className="flex-1 w-full" bounces={false}>
              {users.length === 0 && searching && (
                <VStack className="p-4 justify-center items-center">
                  <Text className="text-secondary-950">
                    No results found on your search.
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
                  bounces={false}
                  className="flex-1"
                  data={users}
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
                      />
                    );
                  }}
                  ItemSeparatorComponent={() => (
                    <Box className="mx-4">
                      <Divider className="border-secondary-100" />
                    </Box>
                  )}
                />
              </CheckboxGroup>
            </ScrollView>
          </LoadingWrapper>
        </Box>
        <Box className="items-center justify-start sticky bottom-0 px-4">
          <Box className="h-4" />
          <HStack className="gap-x-2 pt-4">
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
