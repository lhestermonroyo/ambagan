import FormButton from "@/components/FormButton";
import PressableListItem from "@/components/PressableListItem";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useBookStore from "@/features/book/states/book.state";
import useGroupStore from "@/features/group/states/group.state";
import {
  groupEntryHref,
  groupEntryKey,
  individualGroupEntry,
  isIndividualGroup
} from "@/features/group/utils/groupMode";
import useUserStore from "@/features/user/states/user.state";
import {
  setEmptyStatePreview,
  useEmptyStatePreview
} from "@/hooks/useEmptyStatePreview";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import { Group } from "@/types/groups";
import { UserPreview } from "@/types/user";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";

export default function EmptyStatePreviewScreen() {
  return __DEV__ ? <PreviewControls /> : <Redirect href="/profile" />;
}

function PreviewControls() {
  const router = useRouter();
  const enabled = useEmptyStatePreview();
  const { details: user } = useUserStore();
  const { list: cachedGroups } = useGroupStore();
  const { list: cachedBooks } = useBookStore();
  const [entries, setEntries] = useState<Group[]>([]);
  const [friends, setFriends] = useState<UserPreview[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      services.group.getGroupEntriesByUserId(user.id),
      services.friend.getGroupContacts(user.id)
    ]).then(([groups, contacts]) => {
      if (cancelled) return;
      if (groups.status === "fulfilled") setEntries(groups.value);
      if (contacts.status === "fulfilled") setFriends(contacts.value);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id, refreshToken]);

  // This list stays real so existing details remain reachable during preview.
  const destinations = new Map(
    cachedGroups.map((entry) => [groupEntryKey(entry), entry as Group])
  );
  if (user) cachedBooks.filter((book) => book.user_id === user.id).forEach((book) => {
    const entry = individualGroupEntry(book, user);
    destinations.set(groupEntryKey(entry), entry);
  });
  entries.forEach((entry) => destinations.set(groupEntryKey(entry), entry));

  return (
    <InnerLayout title="Empty State Preview" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <VStack className="gap-y-6 py-4">
          <VStack className="mx-4 p-4 rounded-xl bg-secondary-100 gap-y-3">
            <HStack className="items-center gap-x-4">
              <Text bold className="flex-1 text-lg">Simulate Empty Lists</Text>
              <Switch
                accessibilityLabel="Simulate empty lists"
                value={enabled}
                onValueChange={setEmptyStatePreview}
              />
            </HStack>
            <Text className="text-secondary-950">
              Hides rows on the actual screens and pickers. Your saved data,
              selected members, and permissions stay intact. Turn it off at any
              time using the banner. A full app reload also turns it off.
            </Text>
            <Text className="text-sm text-secondary-950">
              Buttons open the real flows. Turn preview off before saving or
              editing data. For search states, open search and enter any text.
            </Text>
          </VStack>

          <VStack className="px-4 gap-y-2">
            <Text bold className="text-lg">App Screens</Text>
            <FormButton text="Overview" variant="outline" onPress={() => router.push("/(tabs)/(home)")} />
            <FormButton text="Groups & Individual" variant="outline" onPress={() => router.push("/groups")} />
            <FormButton text="Friends" variant="outline" onPress={() => router.push("/friends")} />
            <FormButton text="Notifications" variant="outline" onPress={() => router.push("/notifications")} />
            <FormButton text="Spending Analytics" variant="outline" onPress={() => router.push("/profile/analytics")} />
            <FormButton text="Help Center Search" variant="outline" onPress={() => router.push("/profile/help-center")} />
          </VStack>

          <VStack className="gap-y-1">
            <Text bold className="text-lg px-4">Existing Groups & Individual Entries</Text>
            <Text className="text-sm text-secondary-950 px-4 pb-2">
              Open details here while the main lists are empty. Check their tabs,
              recurring expenses, and member pickers.
            </Text>
            {Array.from(destinations.values()).map((entry) => (
              <PressableListItem key={groupEntryKey(entry)} onPress={() => router.push(groupEntryHref(entry))}>
                <VStack className="px-4 py-3">
                  <Text className="text-lg">{entry.name}</Text>
                  <Text className="text-sm text-secondary-950">
                    {isIndividualGroup(entry) ? "Individual" : "Group"}{entry.archived ? " · Archived" : ""}
                  </Text>
                </VStack>
              </PressableListItem>
            ))}
            {!loading && destinations.size === 0 && (
              <Text className="px-4 text-secondary-950">No saved entries available. Create one with preview turned off first.</Text>
            )}
          </VStack>

          {friends.length > 0 && (
            <VStack>
              <Text bold className="text-lg px-4 pb-2">Existing Friends</Text>
              {friends.map((friend) => (
                <PressableListItem key={friend.id} onPress={() => router.push({
                  pathname: "/friends/[friendId]",
                  params: { friendId: friend.id, name: `${friend.first_name} ${friend.last_name}`, email: friend.email, avatar: friend.avatar ?? "" }
                })}>
                  <Text className="px-4 py-3 text-lg">{friend.first_name} {friend.last_name}</Text>
                </PressableListItem>
              ))}
            </VStack>
          )}
          <VStack className="px-4">
            <FormButton text={loading ? "Loading Destinations…" : "Refresh Destinations"} variant="outline" disabled={loading} onPress={() => setRefreshToken((value) => value + 1)} />
          </VStack>
        </VStack>
      </ScrollView>
    </InnerLayout>
  );
}
