import FormButton from "@/components/FormButton";
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
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import services from "@/services";
import states from "@/states";
import { UserPreview } from "@/types/user";
import { Fragment, useEffect, useState } from "react";
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
  const [tab, setTab] = useState<"recent" | "favorites">("recent");
  const [selected, setSelected] = useState<UserPreview[]>([]);
  const [users, setUsers] = useState<UserPreview[]>([]);

  const user = states.user();
  const { details: userDetails } = user;

  useEffect(() => {
    setSelected(members);
  }, [members]);

  useEffect(() => {
    fetchUsers();
  }, [searchInput]);

  const fetchUsers = async () => {
    try {
      if (!searching) {
        setUsers([]);
        return;
      }
      const data = await services.user.searchUsers(searchInput);
      const filteredUsers = data.filter((u) => u.id !== userDetails?.id);

      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleChangeMembers = (selected: (string | number)[]) => {
    const selectedUsers = users.filter((user) => selected.includes(user.id));

    setSelected((prev) => {
      const newMembers = selectedUsers.filter(
        (user) => !prev.some((member) => member.id === user.id)
      );
      const removedMembers = prev.filter(
        (member) =>
          !selected.includes(member.id) && member.id !== userDetails?.id
      );

      console.log(newMembers);
      console.log(removedMembers);

      return [
        ...newMembers,
        ...prev.filter(
          (member) => !removedMembers.some((m) => m.id === member.id)
        )
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
    setTab("recent");
    setSearchInput("");
    setSearching(false);
  };

  const handleSaveMembers = () => {
    onSaveMembers(selected);
    handleClearStates();
    onClose();
  };

  const handleClose = () => {
    handleClearStates();
    onClose();
  };

  return (
    <Fragment>
      <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[94]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full gap-y-4 py-4 bg-typography-0">
            <VStack>
              <HStack className="px-4">
                <Text className="text-secondary-950 flex-1">
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
              value={selected.map((member) => member.id)}
              onChange={handleChangeMembers}
            >
              <FlatList
                scrollEnabled={false}
                bounces={false}
                className="flex-1"
                data={users}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => {
                  const isCreator = item.id === userDetails?.id;

                  return (
                    <UserCheckboxItem
                      key={item.id}
                      item={item}
                      disabled={isCreator}
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
