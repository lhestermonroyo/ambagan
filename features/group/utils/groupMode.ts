import type { Book } from "@/types/books";
import { GroupMode, GroupRole, type Group, type Member } from "@/types/groups";
import type { UserPreview } from "@/types/user";

export const isIndividualGroup = (group: Pick<Group, "mode">) =>
  group.mode === GroupMode.INDIVIDUAL;

export const groupEntryKey = (group: Pick<Group, "id" | "mode">) =>
  `${group.mode ?? GroupMode.GROUP}:${group.id}`;

export const groupEntryHref = (group: Pick<Group, "id" | "mode">) =>
  isIndividualGroup(group) ? `/books/${group.id}` as const : `/groups/${group.id}` as const;

/** Existing private ledgers become Individual entries without duplicating data. */
export function individualGroupEntry(book: Book, owner: UserPreview): Group & { members: Member[] } {
  if (book.user_id !== owner.id) throw new Error("Individual entries belong to their owner");
  return {
    id: book.id,
    mode: GroupMode.INDIVIDUAL,
    created_at: book.created_at,
    last_updated_at: book.last_updated_at ?? book.created_at,
    admin: owner,
    name: book.name,
    category: book.category,
    avatar: book.avatar,
    currency: book.currency,
    default_expense_currency: book.default_expense_currency,
    archived: book.archived,
    expense_count: book.expense_count,
    pending: book.pending,
    members: [{ ...owner, group_id: book.id, joined_at: book.created_at, role: GroupRole.ADMIN }]
  };
}
