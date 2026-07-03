import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import SearchInput from "@/components/SearchInput";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import {
  Checkbox,
  CheckboxGroup,
  CheckboxIcon,
  CheckboxIndicator
} from "@/components/ui/checkbox";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { CONTACT_MEMBER_PREFIX } from "@/features/group/services/member.service";
import useAppToast from "@/hooks/use-app-toast";
import { UserPreview } from "@/types/user";
import { normalizePhone } from "@/utils/phone";
import * as Contacts from "expo-contacts";
import { CheckIcon } from "lucide-react-native";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";

type PickableContact = {
  key: string; // normalized phone (also the dedupe key within the picker)
  first_name: string;
  last_name: string;
  phone: string; // normalized E.164
  avatar: string | null;
};

/** Build a member-shaped object for a picked contact. Its id is a temp marker
 *  (`contact:<phone>`) that resolveContactMembers swaps for a real id on save. */
export function toContactMember(c: PickableContact): UserPreview {
  return {
    id: `${CONTACT_MEMBER_PREFIX}${c.phone}`,
    first_name: c.first_name,
    last_name: c.last_name,
    email: "",
    phone: c.phone,
    avatar: c.avatar,
    plan: "free",
    is_placeholder: true
  };
}

export default function ContactPickerSheet({
  isOpen,
  onClose,
  excludePhones = [],
  onAdd
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Normalized phones already in the group, hidden from the picker. */
  excludePhones?: string[];
  onAdd: (members: UserPreview[]) => void;
}) {
  const [permission, setPermission] =
    useState<Contacts.PermissionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<PickableContact[]>([]);
  const [selected, setSelected] = useState<Record<string, PickableContact>>({});
  const [searchInput, setSearchInput] = useState("");

  const toast = useAppToast();
  const exclude = useMemo(() => new Set(excludePhones), [excludePhones]);

  useEffect(() => {
    if (isOpen) {
      setSelected({});
      setSearchInput("");
      loadContacts();
    }
  }, [isOpen]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      setPermission(status);
      if (status !== Contacts.PermissionStatus.GRANTED) return;

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Image
        ]
      });

      // One row per contact, using their first usable phone number. De-dupe by
      // normalized phone and drop anyone already in the group.
      const byPhone = new Map<string, PickableContact>();
      for (const c of data) {
        const raw = c.phoneNumbers?.[0]?.number;
        const phone = normalizePhone(raw);
        if (!phone || exclude.has(phone) || byPhone.has(phone)) continue;

        const first = c.firstName?.trim() || c.name?.trim() || "Invited";
        byPhone.set(phone, {
          key: phone,
          first_name: first,
          last_name: c.lastName?.trim() || "",
          phone,
          avatar: c.imageAvailable && c.image?.uri ? c.image.uri : null
        });
      }

      setContacts(
        Array.from(byPhone.values()).sort((a, b) =>
          `${a.first_name} ${a.last_name}`.localeCompare(
            `${b.first_name} ${b.last_name}`
          )
        )
      );
    } catch (error) {
      console.error("Failed to load contacts:", error);
      toast({
        title: "Couldn't load contacts",
        description: "Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [contacts, searchInput]);

  const contactsByKey = useMemo(() => {
    const map = new Map<string, PickableContact>();
    for (const c of contacts) map.set(c.key, c);
    return map;
  }, [contacts]);

  const handleChange = (values: (string | number)[]) =>
    setSelected((prev) => {
      const next: Record<string, PickableContact> = {};
      for (const value of values) {
        const key = value.toString();
        const contact = prev[key] ?? contactsByKey.get(key);
        if (contact) next[key] = contact;
      }
      return next;
    });

  const selectedKeys = useMemo(() => Object.keys(selected), [selected]);
  const selectedCount = selectedKeys.length;

  const handleAdd = () => {
    const added = Object.values(selected);
    if (added.length === 0) return;

    onAdd(added.map(toContactMember));

    // Drop the just-added contacts from the list and reset the selection so the
    // sheet stays open for another batch. They won't reappear this session.
    const addedKeys = new Set(added.map((c) => c.key));
    setContacts((prev) => prev.filter((c) => !addedKeys.has(c.key)));
    setSelected({});

    toast({
      title:
        added.length === 1
          ? "1 contact added"
          : `${added.length} contacts added`,
      description: "Keep adding, or tap Done when you're finished.",
      type: "success"
    });
  };

  const denied =
    permission === Contacts.PermissionStatus.DENIED ||
    permission === Contacts.PermissionStatus.UNDETERMINED;

  return (
    <Fragment>
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <VStack className="w-full flex-1">
            <Pressable onPress={onClose}>
              <HStack className="p-4 items-start">
                <Icon as="arrow-back-ios" className="text-secondary-950" />
                <VStack className="flex-1 gap-y-1">
                  <Text bold className="text-xl">
                    Add from Contacts
                  </Text>
                  <Text className="text-sm text-secondary-950 w-full">
                    People you add from contacts can see and claim these shared
                    expenses when they join Ambagan.
                  </Text>
                </VStack>
              </HStack>
            </Pressable>

            {permission === Contacts.PermissionStatus.GRANTED ? (
              <VStack className="flex-1 gap-y-2">
                <Box className="px-4">
                  <SearchInput
                    placeholder="Search contacts"
                    value={searchInput}
                    onChangeText={setSearchInput}
                  />
                </Box>
                <Box className="px-4">
                  <Pressable onPress={() => Linking.openSettings()}>
                    <Text className="text-sm text-primary-400">
                      Missing someone? Manage contact access in Settings
                    </Text>
                  </Pressable>
                </Box>
                <CheckboxGroup
                  className="flex-1"
                  value={selectedKeys}
                  onChange={handleChange}
                >
                  <FlatList
                    className="flex-1"
                    data={filtered}
                    keyExtractor={(item) => item.key}
                    renderItem={({ item }) => (
                      <Checkbox
                        size="lg"
                        value={item.key}
                        aria-label={`Select ${item.first_name}`}
                        className="p-4"
                      >
                        <HStack className="gap-x-3 items-center flex-1">
                          <CheckboxIndicator>
                            <CheckboxIcon as={CheckIcon} />
                          </CheckboxIndicator>
                          <AppAvatar
                            name={item.first_name}
                            uri={item.avatar || undefined}
                          />
                          <VStack className="flex-1">
                            <Text className="text-lg">
                              {item.first_name} {item.last_name}
                            </Text>
                            <Text className="text-sm text-secondary-950">
                              {item.phone}
                            </Text>
                          </VStack>
                        </HStack>
                      </Checkbox>
                    )}
                    ItemSeparatorComponent={ListDivider}
                    ListEmptyComponent={() => (
                      <VStack className="p-4 items-center">
                        <Text className="text-sm text-secondary-950">
                          {loading ? "Loading contacts…" : "No contacts found."}
                        </Text>
                      </VStack>
                    )}
                    ListFooterComponent={() => <Box className="h-4" />}
                  />
                </CheckboxGroup>
              </VStack>
            ) : (
              <VStack className="flex-1 items-center justify-center gap-y-4 px-8">
                <Icon as="contacts" size={48} className="text-secondary-950" />
                <Text className="text-center text-secondary-950">
                  Ambagan needs access to your contacts to add people to your
                  groups. {denied ? "Enable it in Settings to continue." : ""}
                </Text>
                <FormButton
                  text="Open Settings"
                  onPress={() => Linking.openSettings()}
                />
              </VStack>
            )}
          </VStack>

          {permission === Contacts.PermissionStatus.GRANTED && (
            <Box className="items-center justify-center p-4">
              <HStack className="gap-x-2">
                <FormButton
                  className="flex-1"
                  variant="outline"
                  text="Done"
                  onPress={onClose}
                />
                <FormButton
                  className="flex-1"
                  text={
                    selectedCount > 0
                      ? `Add Selected (${selectedCount})`
                      : "Add Selected"
                  }
                  disabled={selectedCount === 0}
                  onPress={handleAdd}
                />
              </HStack>
            </Box>
          )}
        </ActionsheetContent>
      </Actionsheet>
    </Fragment>
  );
}
