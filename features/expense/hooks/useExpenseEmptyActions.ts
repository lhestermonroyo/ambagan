import type { EmptyListAction } from "@/components/EmptyList";
import useBookStore from "@/features/book/states/book.state";
import useGroupStore from "@/features/group/states/group.state";
import { hasEnoughMembersForExpense } from "@/features/group/utils/groupMembers";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import { useRouter } from "expo-router";

/** Keep empty-state shortcuts scoped to the current expense destination. */
export function useExpenseEmptyActions({
  groupId,
  bookId,
  onViewMembers
}: {
  groupId?: string;
  bookId?: string;
  onViewMembers?: () => void;
}): EmptyListAction[] {
  const router = useRouter();
  const ensureOnline = useEnsureOnline();
  // These are Zustand hooks. Their use-prefixed names keep React Compiler
  // from memoizing the calls and skipping hooks on subsequent renders.
  const { details, list: groups, memberList } = useGroupStore();
  const { list: books } = useBookStore();
  const group =
    groupId && details?.id === groupId
      ? { ...details, members: memberList }
      : groups.find((item) => item.id === groupId);
  const book = books.find((item) => item.id === bookId);

  if (group?.archived || book?.archived) {
    return [
      { label: "View Groups", onPress: () => router.push("/groups") }
    ];
  }
  if (group && !hasEnoughMembersForExpense(group)) {
    return [
      {
        label: "View Members",
        onPress:
          onViewMembers ??
          (() => router.push({
            pathname: "/groups/[groupId]",
            params: { groupId: group.id, tab: "Members" }
          }))
      }
    ];
  }

  const base = bookId
    ? `/books/${bookId}`
    : groupId
      ? `/groups/${groupId}`
      : "/groups/[groupId]";
  return [
    {
      label: "Add Expense",
      onPress: () => router.push(`${base}/add-expense` as any)
    },
    {
      label: "Scan Receipt",
      onPress: async () => {
        if (
          !(await ensureOnline(
            "You need an internet connection to scan a receipt. Please try again when you're back online."
          ))
        ) return;
        router.push(
          (groupId || bookId ? `${base}/scan-receipt` : "/scan-receipt") as any
        );
      }
    }
  ];
}
