import states from "@/states";
import { Book, BookBudgetPeriod } from "@/types/books";
import { cacheService } from "@/utils/cacheService";
import { tables } from "@/utils/constants";
import * as offlineQueue from "@/utils/offlineQueue";
import { isUniqueViolation, supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { ImagePickerSuccessResult } from "expo-image-picker";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

// The group embed is hinted with the FK constraint name so PostgREST can't pick
// a different relationship if another books→groups link is ever added. It
// resolves to null both when the book is unlinked AND when the owner has since
// left the group (groups_tbl RLS hides it) — callers must treat a set `group_id`
// with a null `linked_group` as "linked, but not readable", not as unlinked.
const BOOK_SELECT = `id, created_at, user_id, name, category, avatar, currency, budget, budget_period, archived, group_id, linked_group:${tables.GROUPS_TBL}!personal_books_tbl_group_id_fkey(id, name, avatar, currency, category)`;

export const LINKED_GROUP_CONFLICT_MESSAGE =
  "You already have a book linked to this group. Unlink it first, or pick a different group.";

export const NOT_GROUP_MEMBER_MESSAGE =
  "You can only link a book to a group you're a member of.";

/**
 * True for the `personal_books_user_group_uniq` collision — the one-book-per-
 * group rule. Checked by constraint name because a plain 23505 on this table
 * could equally be a replayed offline insert on the primary key, which callers
 * deliberately swallow as a no-op.
 */
const isLinkedGroupConflict = (error: unknown): boolean =>
  isUniqueViolation(error) &&
  typeof (error as { message?: string })?.message === "string" &&
  (error as { message: string }).message.includes(
    "personal_books_user_group_uniq"
  );

/** True for the `enforce_book_group_membership` trigger's check_violation. */
const isNotGroupMember = (error: unknown): boolean =>
  !!error &&
  typeof error === "object" &&
  typeof (error as { message?: string }).message === "string" &&
  (error as { message: string }).message.includes(
    "not a member of"
  );

export const saveBook = async ({
  name,
  category,
  avatar,
  currency,
  budget,
  budget_period,
  group_id,
  user_id,
  id
}: {
  name: string;
  category: string;
  avatar: ImagePickerSuccessResult | null;
  currency: string;
  /** Null = no budget on this book. */
  budget?: number | null;
  budget_period?: BookBudgetPeriod;
  /** Group to roll this book up with. Null/omitted = standalone. */
  group_id?: string | null;
  user_id: string;
  /** Optional pre-generated id — used so offline-queued books keep a stable id on sync. */
  id?: string;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  if (user_id !== user.data.user.id) {
    throw new Error("Book owner must be the authenticated user");
  }

  const bookId = id ?? uuid();
  let avatarUrl: string | null = null;

  if (avatar) {
    const uploadResponse = await uploadFile(avatar.assets[0], "avatars");

    if (uploadResponse.error) throw uploadResponse.error;

    avatarUrl = uploadResponse.data?.publicUrl || null;
  }

  const { error } = await supabase.from(tables.PERSONAL_BOOKS_TBL).insert([
    {
      id: bookId,
      user_id,
      name,
      category,
      avatar: avatarUrl,
      currency: currency || "PHP",
      budget: budget ?? null,
      budget_period: budget_period ?? "monthly",
      group_id: group_id ?? null
    }
  ]);

  // A book has no child rows, so an offline sync retry that already committed
  // the row hits a unique violation on the pinned id — treat that as an
  // idempotent no-op (the book already exists) rather than a failure.
  //
  // A unique violation can ALSO mean the group link collided (one book per user
  // per group), which is a genuine conflict rather than a replayed write — tell
  // those apart by the constraint name before swallowing it.
  if (error && isLinkedGroupConflict(error)) {
    throw new Error(LINKED_GROUP_CONFLICT_MESSAGE);
  }

  if (error && isNotGroupMember(error)) {
    throw new Error(NOT_GROUP_MEMBER_MESSAGE);
  }

  if (error && !isUniqueViolation(error)) {
    throw error;
  }

  return {
    message: "Book created successfully",
    data: { bookId }
  };
};

export const updateBook = async (
  bookId: string,
  payload: {
    name: string;
    category: string;
    currency: string;
    /** Null clears the budget; undefined leaves it untouched. */
    budget?: number | null;
    budget_period?: BookBudgetPeriod;
    /** Null unlinks the book from its group; undefined leaves it untouched. */
    group_id?: string | null;
    avatar: ImagePickerSuccessResult | null;
  }
) => {
  // Offline → queue name/category/currency/budget (avatar uploads are blocked
  // offline) + optimistic cache. Mirrors group.updateGroup.
  if (!(await offlineQueue.isOnline())) {
    const uid = states.user.getState().details?.id;
    if (uid) {
      await offlineQueue.queueUpdateBook(uid, bookId, {
        name: payload.name,
        category: payload.category,
        currency: payload.currency,
        budget: payload.budget ?? null,
        budget_period: payload.budget_period ?? "monthly",
        group_id: payload.group_id ?? null,
        avatar: null
      });
    }
    return { message: "Book will be updated when you're back online" };
  }

  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { name, category, currency, budget, budget_period, group_id, avatar } =
    payload;

  let avatarUrl: string | null = null;

  if (avatar) {
    const uploadResponse = await uploadFile(avatar.assets[0], "avatars");

    if (uploadResponse.error) throw uploadResponse.error;

    avatarUrl = uploadResponse.data?.publicUrl || null;
  }

  const updateData: Record<string, any> = { name, category, currency };
  if (avatarUrl) {
    updateData.avatar = avatarUrl;
  }
  // `undefined` means "not edited here"; an explicit null clears the budget.
  if (budget !== undefined) {
    updateData.budget = budget;
  }
  if (budget_period !== undefined) {
    updateData.budget_period = budget_period;
  }
  // Same convention as budget: `undefined` means "not edited here", an explicit
  // null unlinks the book from its group.
  if (group_id !== undefined) {
    updateData.group_id = group_id;
  }

  // Owner-only RLS keeps this scoped to the current user's own book.
  const { error } = await supabase
    .from(tables.PERSONAL_BOOKS_TBL)
    .update(updateData)
    .eq("id", bookId)
    .eq("user_id", user.data.user.id);

  if (isLinkedGroupConflict(error)) throw new Error(LINKED_GROUP_CONFLICT_MESSAGE);
  if (isNotGroupMember(error)) throw new Error(NOT_GROUP_MEMBER_MESSAGE);
  if (error) throw error;

  return { message: "Book updated successfully" };
};

/**
 * Point a book at a group, or unlink it with `null`. The focused mutation behind
 * the group Stats "Link a book" CTA — `updateBook` would need the book's whole
 * name/category/currency payload just to change this one column.
 *
 * ONLINE ONLY: the roll-up it enables can't be computed offline anyway (the
 * group half needs the member splits), so queueing the link would leave the user
 * staring at an unchanged card with no explanation.
 */
export const linkBookToGroup = async (
  bookId: string,
  groupId: string | null
) => {
  if (!(await offlineQueue.isOnline())) {
    throw new Error(
      "Linking a book to a group needs an internet connection. Please try again when you're back online."
    );
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.PERSONAL_BOOKS_TBL)
    .update({ group_id: groupId })
    .eq("id", bookId)
    .eq("user_id", user.data.user.id);

  if (isLinkedGroupConflict(error)) throw new Error(LINKED_GROUP_CONFLICT_MESSAGE);
  if (isNotGroupMember(error)) throw new Error(NOT_GROUP_MEMBER_MESSAGE);
  if (error) throw error;

  return {
    message: groupId ? "Book linked to group" : "Book unlinked from group"
  };
};

/**
 * The current user's book for a group, or null when they haven't linked one.
 * At most one row can match — `personal_books_user_group_uniq` guarantees it —
 * so this is the group Stats card's find step before it offers to link.
 *
 * Archived books still count: archiving hides a book from the list, it doesn't
 * erase the spending that already happened on the trip.
 */
export const getBookByGroupId = async (
  groupId: string
): Promise<Book | null> => {
  try {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from(tables.PERSONAL_BOOKS_TBL)
      .select(BOOK_SELECT)
      .eq("group_id", groupId)
      .eq("user_id", user.data.user.id)
      .maybeSingle();

    if (error) throw error;

    return data ? ({ ...(data as any), expense_count: 0 } as Book) : null;
  } catch {
    // Offline — the cached active list carries group_id, so the link itself
    // still resolves even though the roll-up's group half won't.
    const uid = states.user.getState().details?.id;
    if (!uid) return null;
    const list = (await cacheService
      .getBooksList(uid)
      .catch(() => null)) as Book[] | null;
    return list?.find((b) => b.group_id === groupId) ?? null;
  }
};

export const deleteBook = async (bookId: string) => {
  // Hard cascade delete — ONLINE ONLY (mirrors deleteGroup): a destructive
  // delete must not run optimistically and then diverge from the server.
  if (!(await offlineQueue.isOnline())) {
    throw new Error(
      "Deleting a book needs an internet connection. Please try again when you're back online."
    );
  }

  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  // Hard cascade delete: remove the book's personal expenses first, then the
  // book itself. No settlements/members to reconcile, so unlike a group this is
  // a straightforward two-step delete.
  const { error: expensesError } = await supabase
    .from(tables.PERSONAL_EXPENSES_TBL)
    .delete()
    .eq("book_id", bookId)
    .eq("user_id", user.data.user.id);

  if (expensesError) throw expensesError;

  const { error } = await supabase
    .from(tables.PERSONAL_BOOKS_TBL)
    .delete()
    .eq("id", bookId)
    .eq("user_id", user.data.user.id);

  if (error) throw error;

  return { success: true, message: "Book deleted successfully" };
};

export const getBooksByUserId = async (userId: string): Promise<Book[]> => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from(tables.PERSONAL_BOOKS_TBL)
    .select(`${BOOK_SELECT}, expenses:${tables.PERSONAL_EXPENSES_TBL}(count)`)
    .eq("user_id", userId)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as any[]).map(({ expenses, ...book }) => ({
    ...book,
    expense_count: (expenses as any[])?.[0]?.count ?? 0
  })) as Book[];
};

const BOOKS_PAGE_SIZE = 15;

export type BookFilter = "all" | "archived";

export const getBooksByUserIdPaginated = async (
  userId: string,
  page: number = 0,
  filter: BookFilter = "all"
): Promise<{ data: Book[]; hasNext: boolean }> => {
  try {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("User not authenticated");

    const from = page * BOOKS_PAGE_SIZE;
    const to = from + BOOKS_PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from(tables.PERSONAL_BOOKS_TBL)
      .select(
        `${BOOK_SELECT}, expenses:${tables.PERSONAL_EXPENSES_TBL}(count)`,
        { count: "exact" }
      )
      .eq("user_id", userId)
      .eq("archived", filter === "archived")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const books = (data as any[]).map(({ expenses, ...book }) => ({
      ...book,
      expense_count: (expenses as any[])?.[0]?.count ?? 0
    })) as Book[];

    const totalPages = Math.ceil((count || 0) / BOOKS_PAGE_SIZE);
    const result = { data: books, hasNext: page < totalPages - 1 };

    // Cache the complete active list (first page, no more pages) for offline.
    if (page === 0 && filter === "all" && !result.hasNext) {
      cacheService.saveBooksList(userId, result.data).catch(() => {});
    }

    return result;
  } catch (error) {
    // Offline / fetch failure — serve the cached active snapshot on page 0.
    if (page > 0) return { data: [], hasNext: false };

    const cached = (await cacheService.getBooksList(userId)) as Book[] | null;
    if (!cached) throw error;
    // Only the active (non-archived) list is cached; archived isn't available offline.
    return { data: filter === "archived" ? [] : cached, hasNext: false };
  }
};

export const getBookById = async (bookId: string): Promise<Book> => {
  try {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("User not authenticated");

    // The count is embedded the same way the list queries do it. It used to be
    // hardcoded to 0 here, which meant Book Info's "Expenses" row reset to zero
    // the moment the detail fetch resolved over the value carried in from the
    // books list — and never moved again as expenses were added.
    const { data, error } = await supabase
      .from(tables.PERSONAL_BOOKS_TBL)
      .select(`${BOOK_SELECT}, expenses:${tables.PERSONAL_EXPENSES_TBL}(count)`)
      .eq("id", bookId)
      .single();

    if (error) throw error;

    const { expenses, ...book } = data as any;

    return {
      ...book,
      expense_count: (expenses as any[])?.[0]?.count ?? 0
    } as Book;
  } catch (error) {
    // Offline — the cached book detail (or active list) carries the meta.
    const detail = await cacheService.getBookDetail(bookId);
    if (detail?.book) return detail.book as Book;
    const uid = states.user.getState().details?.id;
    if (uid) {
      const list = (await cacheService.getBooksList(uid)) as Book[] | null;
      const found = list?.find((b) => b.id === bookId);
      if (found) return found;
    }
    throw error;
  }
};

export const archiveBook = async (bookId: string) => {
  if (!(await offlineQueue.isOnline())) {
    const uid = states.user.getState().details?.id;
    if (uid) await offlineQueue.queueSetBookArchived(uid, bookId, true);
    return { success: true };
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.PERSONAL_BOOKS_TBL)
    .update({ archived: true })
    .eq("id", bookId)
    .eq("user_id", user.data.user.id);

  if (error) throw error;
  return { success: true };
};

export const unarchiveBook = async (bookId: string) => {
  if (!(await offlineQueue.isOnline())) {
    const uid = states.user.getState().details?.id;
    if (uid) await offlineQueue.queueSetBookArchived(uid, bookId, false);
    return { success: true };
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.PERSONAL_BOOKS_TBL)
    .update({ archived: false })
    .eq("id", bookId)
    .eq("user_id", user.data.user.id);

  if (error) throw error;
  return { success: true };
};
