import {
  default as AppAvatar,
  default as Avatar
} from "@/components/AppAvatar";
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
import {
  Checkbox,
  CheckboxGroup,
  CheckboxIcon,
  CheckboxIndicator
} from "@/components/ui/checkbox";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import services from "@/services";
import states from "@/states";
import { User } from "@/types/user";
import { CheckIcon } from "lucide-react-native";
import { useEffect, useState } from "react";

export default function SelectMembersSheet({
  isOpen,
  onClose,
  onSaveMembers
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaveMembers: (user: User[]) => void;
}) {
  const [tab, setTab] = useState<"recent" | "favorites">("recent");
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<User[]>([]);

  const user = states.user.getState();

  useEffect(() => {
    if (user.session && user.details) {
      setMembers([user.details]);
    }

    return () => {
      setMembers([]);
    };
  }, []);

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
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleChangeMembers = (selected: (string | number)[]) => {
    const selectedUsers = users.filter((user) => selected.includes(user.id));
    setMembers((prev) => {
      const newMembers = selectedUsers.filter(
        (user) => !prev.some((member) => member.id === user.id)
      );
      const removedMembers = prev.filter(
        (member) =>
          !selected.includes(member.id) && member.id !== user.details?.id
      );
      return [
        ...prev.filter((member) => !removedMembers.includes(member)),
        ...newMembers
      ];
    });
  };

  const handleRemoveAllMembers = () => {
    setMembers((prev) =>
      prev.filter((member) => member.id === user.details?.id)
    );
  };

  const handleClearStates = () => {
    setTab("recent");
    setSearchInput("");
    setSearching(false);
  };

  const handleSaveMembers = () => {
    // clear states
    onSaveMembers(members);
    handleClearStates();
    onClose();
  };

  const handleClose = () => {
    handleClearStates();
    onClose();
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[94]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4 py-4 bg-typography-0">
          <Box className="px-4">
            <SearchInput
              placeholder="Search members"
              value={searchInput}
              onChangeText={(val) => setSearchInput(val)}
              onSetSearching={setSearching}
            />
          </Box>
          {members.length > 0 ? (
            <VStack className="gap-y-2">
              <HStack className="px-4">
                <Text className="text-secondary-950 flex-1">
                  {members.length} member
                  {members.length > 1 ? "s" : ""} selected
                </Text>
                <Pressable
                  onPress={handleRemoveAllMembers}
                  disabled={
                    members.includes(user.details!) && members.length === 1
                  }
                >
                  <Text className="text-primary-400">Remove All</Text>
                </Pressable>
              </HStack>
              <ScrollView
                className="px-4"
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                <HStack className="gap-x-4 py-2">
                  {members.map((member) => {
                    const isCreator = member.id === user.details?.id;

                    return (
                      <Pressable
                        key={member.id}
                        onPress={() =>
                          !isCreator &&
                          handleChangeMembers(
                            members
                              .filter((m) => m.id !== member.id)
                              .map((m) => m.id)
                          )
                        }
                      >
                        <VStack className="relative justify-center items-center gap-y-2 max-w-[70px]">
                          <VStack>
                            {!isCreator && (
                              <Box className="absolute right-0 bottom-0 z-10 bg-primary-500 rounded-full p-1">
                                <Icon
                                  as="clear"
                                  size={12}
                                  className="text-background-0"
                                />
                              </Box>
                            )}
                            <Avatar
                              name={member.first_name || ""}
                              uri={member.avatar!}
                              className="rounded-full p-1 bg-primary-400"
                            />
                          </VStack>
                          <VStack className="items-center gap-y-0">
                            <Text className="text-center break-words">
                              {member.first_name} {member.last_name}
                            </Text>
                            {isCreator && (
                              <Text className="text-secondary-950">
                                Creator
                              </Text>
                            )}
                          </VStack>
                        </VStack>
                      </Pressable>
                    );
                  })}
                </HStack>
              </ScrollView>
            </VStack>
          ) : (
            <Text className="text-secondary-950">No members selected yet.</Text>
          )}
          <HStack className="gap-x-2 px-4">
            <FormButton
              variant={tab === "recent" ? "solid" : "outline"}
              className="flex-1"
              text="Recent"
              onPress={() => setTab("recent")}
            />
            <FormButton
              variant={tab === "favorites" ? "solid" : "outline"}
              className="flex-1"
              text="Favorites"
              onPress={() => setTab("favorites")}
            />
          </HStack>
        </VStack>
        <ScrollView className="flex-1 w-full">
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
            {users.map((item) => {
              return (
                <UserItem
                  key={item.id}
                  item={item}
                  isCreator={item.id === user.details?.id}
                  isLast={item.id === users[users.length - 1].id}
                />
              );
            })}
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
  );
}

function UserItem({
  item,
  isCreator,
  isLast
}: {
  item: User;
  isCreator: boolean;
  isLast: boolean;
}) {
  return (
    <Checkbox
      size="lg"
      key={item.id}
      value={item.id.toString()}
      isDisabled={isCreator}
      className="px-4 justify-between"
    >
      <VStack
        className={`flex-1 gap-y-4 py-4 ${!isLast && "border-b border-background-200"}`}
      >
        <HStack className="items-center">
          <HStack className="gap-x-2 items-center flex-1">
            <AppAvatar name={item.first_name} uri={item.avatar!} size="md" />
            <VStack>
              <Text className="text-lg">
                {item?.first_name} {item?.last_name} {isCreator && "(Creator)"}
              </Text>
              <Text className="text-secondary-950">{item?.email}</Text>
            </VStack>
          </HStack>
          <CheckboxIndicator>
            <CheckboxIcon as={CheckIcon} />
          </CheckboxIndicator>
        </HStack>
      </VStack>
    </Checkbox>
  );
}
