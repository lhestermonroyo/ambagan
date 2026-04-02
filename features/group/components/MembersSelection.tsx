import { default as AppAvatar } from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import SearchInput from "@/components/SearchInput";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
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
import { Member } from "@/types/groups";
import { User } from "@/types/user";
import { Fragment, useEffect, useState } from "react";
import SelectedMemberItem from "./SelectedMemberItem";
import { UserCheckboxItem } from "./UserCheckboxItem";

export default function MembersSelection({
  isOpen,
  onClose,
  finalMembers,
  onSaveMembers
}: {
  isOpen: boolean;
  onClose: () => void;
  finalMembers: Member[];
  onSaveMembers: (members: Member[]) => void;
}) {
  const [tab, setTab] = useState<"recent" | "favorites">("recent");
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const user = states.user();
  const { details: userDetails } = user;

  useEffect(() => {
    init();

    return () => {
      setMembers([]);
    };
  }, [isOpen]);

  useEffect(() => {
    fetchUsers();
  }, [searchInput]);

  const init = () => {
    if (finalMembers.length > 0) {
      setMembers(finalMembers);
      return;
    }

    const initialUser = userDetails as User;
    setMembers([
      {
        id: initialUser.id,
        email: initialUser.email,
        avatar: initialUser.avatar,
        first_name: initialUser.first_name,
        last_name: initialUser.last_name
      } as Member
    ]);
  };

  const fetchUsers = async () => {
    try {
      if (!searching) {
        setUsers([]);
        return;
      }
      const data = await services.user.searchUsers(searchInput);
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleChangeMembers = (selected: (string | number)[]) => {
    const selectedUsers = users
      .filter((user) => selected.includes(user.id))
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
        (member) =>
          !selected.includes(member.id) && member.id !== userDetails?.id
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

  const handleRemoveAllMembers = () => {
    setMembers((prev) =>
      prev.filter((member) => member.id === userDetails?.id)
    );
  };

  const handleClearStates = () => {
    setTab("recent");
    setSearchInput("");
    setSearching(false);
  };

  const handleSaveMembers = () => {
    onSaveMembers(members);
    handleClearStates();
    onClose();
  };

  const handleClose = () => {
    handleClearStates();
    onClose();
  };

  return (
    <Fragment>
      <FlatList
        data={finalMembers}
        scrollEnabled={false}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <FinalSelectedMemberItem
            key={item.id}
            item={item}
            onRemove={() => {
              handleRemoveMember(item.id);
              onSaveMembers(members.filter((m) => m.id !== item.id));
            }}
          />
        )}
        ItemSeparatorComponent={() => (
          <Box className="mx-4">
            <Divider className="border-secondary-100" />
          </Box>
        )}
      />
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
                  {members.length} member
                  {members.length > 1 ? "s" : ""} selected
                </Text>
                <Pressable
                  onPress={handleRemoveAllMembers}
                  disabled={
                    members.includes(
                      members.find((m) => m.id === user.details?.id)!
                    ) && members.length === 1
                  }
                >
                  <Text className="text-primary-400">Remove All</Text>
                </Pressable>
              </HStack>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                className="w-full px-4"
                data={members}
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
              value={members.map((member) => member.id)}
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
          <Box className="items-center justify-start sticky bottom-0 px-4">
            <Box className="h-4" />
            <HStack className="gap-x-2 pt-4">
              <FormButton
                className="flex-1"
                variant="outline"
                text="Cancel"
                onPress={handleClose}
              />
              <FormButton
                className="flex-1"
                text="Save Members"
                disabled={members.length === 0}
                onPress={handleSaveMembers}
              />
            </HStack>
          </Box>
        </ActionsheetContent>
      </Actionsheet>
    </Fragment>
  );
}

function FinalSelectedMemberItem({
  item,
  onRemove
}: {
  item: Member;
  onRemove: () => void;
}) {
  const user = states.user();
  const { details: userDetails } = user;

  const isCreator = item.id === userDetails?.id;
  const isMe = item.id === userDetails?.id;

  return (
    <HStack key={item.id} className="py-4 items-center justify-between">
      <HStack className="gap-x-2 items-center flex-1">
        <AppAvatar name={item.first_name} uri={item.avatar!} size="md" />
        <VStack>
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {item?.first_name} {item?.last_name}
              {isMe && " (You)"}
              {isCreator && " (Creator)"}
            </Text>
          </HStack>
          <Text className="text-secondary-950 text-sm">{item?.email}</Text>
        </VStack>
      </HStack>
      {!isCreator && (
        <Button variant="link" className="rounded-full" onPress={onRemove}>
          <Icon as="clear" className="text-secondary-950" />
        </Button>
      )}
    </HStack>
  );
}
