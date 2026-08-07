import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import BookItem from "@/features/book/components/BookItem";
import { scanDraftFor } from "@/features/expense/utils/scanDraft";
import {
  GroupDestination,
  scanDestinations,
  scanFormHref
} from "@/features/expense/utils/scanDestinations";
import InnerLayout from "@/layouts/InnerLayout";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { formatDate } from "@/utils/formatDate";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

/**
 * Where a scanned receipt goes. Groups and personal books in one list, because
 * "group or personal?" and "which one?" are the same decision to the user —
 * splitting them in two steps only means the second one gets answered by a
 * silent default in the form. A row picks both at once and routes to that
 * destination's Add Expense, seeded from the scan.
 *
 * Reached only from the generic scanner (no group/book locked in), and pushed —
 * not replacing it — so backing out of Add Expense lands here, on this list,
 * with the receipt still in hand.
 */
export default function ScanDestinationScreen() {
  const router = useRouter();
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const { details: userDetails } = states.user();
  // Subscribed, not read once: creating a group/book from the empty state below
  // refills these stores, and this screen is where the user lands afterwards.
  const { list: groupList, initialized: groupsInitialized } = states.group();
  const { list: bookList, initialized: booksInitialized } = states.book();

  const { groups, books } = scanDestinations(
    groupList,
    bookList,
    userDetails?.id
  );
  // "Nothing here" and "not loaded yet" look identical in an empty list, and
  // getting that wrong shows a user with groups the create-one-first prompt. The
  // scanner warms both stores before pushing here, so this only covers a
  // prefetch that failed or a deep link straight into this screen.
  const loading = !groupsInitialized || !booksInitialized;
  const isEmpty = groups.length + books.length === 0;

  // The receipt this screen exists to place is gone — it aged out, or it was
  // saved and the user swiped back into this screen. Nothing left to choose for,
  // so step back to the camera rather than show a list that would seed an empty
  // form.
  const hasDraft = !!scanDraftFor(scanId);
  useEffect(() => {
    if (!hasDraft && router.canGoBack()) router.back();
  }, [hasDraft, router]);

  const handleSelect = (destination: { kind: "group" | "book"; id: string }) => {
    if (!scanId) return;
    router.push(scanFormHref(destination, scanId) as any);
  };

  return (
    <InnerLayout title="Where should this go?" onBack={() => router.back()}>
      {loading && isEmpty ? (
        <VStack className="flex-1 items-center justify-center">
          <Spinner size="large" />
        </VStack>
      ) : isEmpty ? (
        <VStack className="flex-1 justify-center gap-y-6 p-6">
          <EmptyList
            type={EmptyType.GROUP}
            content="You don't have a group or a personal book yet — an expense needs somewhere to live. Create one and your scanned receipt will be waiting."
          />
          <VStack className="gap-y-2">
            <FormButton
              text="Create a Group"
              onPress={() => router.push("/groups/create")}
            />
            <FormButton
              variant="outline"
              text="Create a Book"
              onPress={() => router.push("/books/create")}
            />
          </VStack>
        </VStack>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-sm text-secondary-950 px-4 pt-2 pb-4">
            Pick where to add the receipt you just scanned.
          </Text>

          {groups.length > 0 && (
            <VStack className="w-full">
              <SectionHeader label="Split with a group" count={groups.length} />
              {groups.map((group, index) => (
                <Box key={group.id}>
                  {index > 0 && <ListDivider />}
                  <GroupRow
                    group={group}
                    onPress={() => handleSelect({ kind: "group", id: group.id })}
                  />
                </Box>
              ))}
            </VStack>
          )}

          {books.length > 0 && (
            <VStack className="w-full">
              <SectionHeader label="Track it yourself" count={books.length} />
              {books.map((book, index) => (
                <Box key={book.id}>
                  {index > 0 && <ListDivider />}
                  <BookItem
                    details={book}
                    onOpen={() => handleSelect({ kind: "book", id: book.id })}
                  />
                </Box>
              ))}
            </VStack>
          )}
        </ScrollView>
      )}
    </InnerLayout>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <HStack className="px-4 pt-2 pb-2 items-center justify-between">
      <Text bold className="text-sm text-secondary-950 uppercase">
        {label}
      </Text>
      <Text className="text-sm text-secondary-950">{count}</Text>
    </HStack>
  );
}

/** A group row, shaped to match {@link BookItem} so the two sections read as one
 *  list rather than two borrowed designs. */
function GroupRow({
  group,
  onPress
}: {
  group: GroupDestination;
  onPress: () => void;
}) {
  const memberCount = group.members?.length ?? 0;

  return (
    <PressableListItem className="p-4" onPress={onPress}>
      <HStack className="items-center gap-x-3">
        <AppAvatar name={group.name} uri={group.avatar || undefined} />
        <VStack className="flex-1">
          <Text
            className="text-lg flex-shrink"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {group.name}
          </Text>
          <Text className="text-sm text-secondary-950">
            {formatDate(group.created_at)} • {memberCount} member
            {memberCount !== 1 ? "s" : ""}
          </Text>
        </VStack>
        <Icon as="chevron-right" className="text-secondary-950" />
      </HStack>
    </PressableListItem>
  );
}
