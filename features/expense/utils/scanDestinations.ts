import {
  hasEnoughMembersForExpense,
  memberJoinedAtMs
} from "@/features/group/utils/groupMembers";
import services from "@/services";
import states from "@/states";
import { Book } from "@/types/books";
import { Group, Member } from "@/types/groups";

export type GroupDestination = Group & { members: Member[] };

export type ScanDestinations = {
  groups: GroupDestination[];
  books: Book[];
};

/**
 * Everywhere a scanned receipt can land, read from the stores. Filtered the same
 * way the Add Expense forms filter: archived groups/books can't take an expense,
 * and neither can a group that's still just you (nothing to split). Groups are
 * ordered by how recently *you* joined — the same rank the group form's default
 * uses, so the destination picker's first row is the one it would have
 * pre-selected. Books keep their list order (newest first).
 */
export const scanDestinations = (
  groupList: GroupDestination[],
  bookList: Book[],
  userId?: string
): ScanDestinations => ({
  groups: groupList
    .filter((group) => !group.archived && hasEnoughMembersForExpense(group))
    .sort((a, b) => memberJoinedAtMs(b, userId) - memberJoinedAtMs(a, userId)),
  books: bookList.filter((book) => !book.archived)
});

/** The same list, read straight off the stores — for callers outside React. */
export const currentScanDestinations = (userId?: string) =>
  scanDestinations(
    states.group.getState().list,
    states.book.getState().list,
    userId
  );

export const countScanDestinations = (destinations: ScanDestinations) =>
  destinations.groups.length + destinations.books.length;

/**
 * Fill the group and book stores so the destination picker (and the scanner's
 * decision about whether to show it at all) works off real counts rather than
 * "not loaded yet". Called while the user is still framing the receipt, so the
 * lists are ready by the time the scan comes back.
 *
 * Always refetches rather than trusting `initialized`: the stores may be holding
 * the Archived tab's list, which is exactly the set that can't take an expense.
 * A failure is survivable — whatever is cached in the stores gets used instead.
 */
export const loadScanDestinations = async (userId: string) => {
  const [groups, books] = await Promise.allSettled([
    services.group.getGroupsByUserIdPaginated(userId, 0, "all"),
    services.book.getBooksByUserIdPaginated(userId, 0, "all")
  ]);

  if (groups.status === "fulfilled") {
    states.group.setState((prev) => ({
      ...prev,
      list: groups.value.data,
      initialized: true
    }));
  }
  if (books.status === "fulfilled") {
    states.book.setState((prev) => ({
      ...prev,
      list: books.value.data,
      initialized: true
    }));
  }
};

/**
 * Where a scanned receipt's Add Expense form lives. Carries `scanId` (which is
 * what lets the form seed itself — see scanDraft.ts) and `scanStack`, telling
 * the form it was pushed on top of the scanner and should unwind the whole stack
 * once the expense is saved rather than backing up into the picker.
 */
export const scanFormHref = (
  destination: { kind: "group" | "book"; id: string },
  scanId: string
) =>
  destination.kind === "group"
    ? `/groups/${destination.id}/add-expense?scanId=${scanId}&scanStack=1`
    : `/books/${destination.id}/add-expense?scanId=${scanId}&scanStack=1`;
