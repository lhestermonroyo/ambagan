import useBookStore from "@/features/book/states/book.state";
import useGroupStore from "@/features/group/states/group.state";
import useUserStore from "@/features/user/states/user.state";
import { useEmptyStatePreview } from "@/hooks/useEmptyStatePreview";
import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import PressableListItem from "@/components/PressableListItem";
import SearchInput from "@/components/SearchInput";
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
import { EmptyType } from "@/types/general";
import { formatDate } from "@/utils/formatDate";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

// Below this the whole list is already on screen, so a search field would cost
// more room than the scrolling it saves. The picker is skipped entirely at one
// destination (see routeGenericScan), so the real floor here is two.
const SEARCH_MIN_DESTINATIONS = 6;

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
  const previewEmpty = useEmptyStatePreview();
  const router = useRouter();
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const { details: userDetails } = useUserStore();
  // Subscribed, not read once: creating a group/book from the empty state below
  // refills these stores, and this screen is where the user lands afterwards.
  const { list: groupList, initialized: groupsInitialized } = useGroupStore();
  const { list: bookList, initialized: booksInitialized } = useBookStore();

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
  const isEmpty = previewEmpty || groups.length + books.length === 0;

  // `searching` tracks the debounced query rather than "the field has focus", so
  // the sections and the no-results state flip in step with the filtering.
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const showSearch = groups.length + books.length >= SEARCH_MIN_DESTINATIONS;

  // Both gated on `showSearch`: the stores can refill under this screen (the
  // scanner warms them, and the empty state creates into them), so the list can
  // shrink past the threshold while a query is live. Dropping the field without
  // dropping its query would leave the list filtered with no way to clear it.
  const query = showSearch ? searchInput.trim().toLowerCase() : "";
  const isSearching = showSearch && searching;
  const matchedGroups = useMemo(
    () =>
      query
        ? groups.filter((g) => g.name.toLowerCase().includes(query))
        : groups,
    [groups, query]
  );
  const matchedBooks = useMemo(
    () =>
      query ? books.filter((b) => b.name.toLowerCase().includes(query)) : books,
    [books, query]
  );
  const noMatches = matchedGroups.length + matchedBooks.length === 0;

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
    <InnerLayout title="Where Should This Go?" onBack={() => router.back()}>
      {loading && isEmpty ? (
        <VStack className="flex-1 items-center justify-center">
          <Spinner size="large" />
        </VStack>
      ) : isEmpty ? (
        <VStack className="flex-1 justify-center gap-y-6 p-6">
          <EmptyList
            type={EmptyType.GROUP}
            content="Create a group or Individual entry for this receipt. Your scan will be waiting."
          />
        </VStack>
      ) : (
        <VStack className="flex-1">
          {/* Outside the ScrollView: the field stays put while the list moves
              under it, so a long list can be scanned without losing the query. */}
          {showSearch && (
            <Box className="px-4 pt-2 pb-1">
              <SearchInput
                placeholder="Search groups and Individual entries"
                value={searchInput}
                onChangeText={setSearchInput}
                onSetSearching={setSearching}
              />
            </Box>
          )}

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {!isSearching && (
              <Text className="text-sm text-secondary-950 px-4 pt-2 pb-4">
                Pick where to add the receipt you just scanned.
              </Text>
            )}

            {isSearching && noMatches ? (
              <Box className="pt-8">
                <EmptyList
                  type={EmptyType.SEARCH}
                  content={`No group or Individual entry matches "${searchInput.trim()}".`}
                />
              </Box>
            ) : (
              <>
                {matchedGroups.length > 0 && (
                  <VStack className="w-full">
                    <SectionHeader
                      label="Split With a Group"
                      count={matchedGroups.length}
                    />
                    {matchedGroups.map((group, index) => (
                      <Box key={group.id}>
                        {index > 0 && <ListDivider />}
                        <GroupRow
                          group={group}
                          onPress={() =>
                            handleSelect({ kind: "group", id: group.id })
                          }
                        />
                      </Box>
                    ))}
                  </VStack>
                )}

                {matchedBooks.length > 0 && (
                  <VStack className="w-full">
                    <SectionHeader
                      label="Track It Yourself"
                      count={matchedBooks.length}
                    />
                    {matchedBooks.map((book, index) => (
                      <Box key={book.id}>
                        {index > 0 && <ListDivider />}
                        <BookItem
                          details={book}
                          onOpen={() =>
                            handleSelect({ kind: "book", id: book.id })
                          }
                        />
                      </Box>
                    ))}
                  </VStack>
                )}
              </>
            )}
          </ScrollView>
        </VStack>
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
