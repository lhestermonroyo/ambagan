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

const BOOK_SELECT = `id, created_at, user_id, name, category, avatar, currency, budget, budget_period, archived, group_id`;

export const saveBook = async ({
  name,
  category,
  avatar,
  currency,
  budget,
  budget_period,
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
      budget_period: budget_period ?? "monthly"
    }
  ]);

  // A book has no child rows, so an offline sync retry that already committed
  // the row hits a unique violation on the pinned id — treat that as an
  // idempotent no-op (the book already exists) rather than a failure.
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
        avatar: null
      });
    }
    return { message: "Book will be updated when you're back online" };
  }

  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { name, category, currency, budget, budget_period, avatar } = payload;

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

  // Owner-only RLS keeps this scoped to the current user's own book.
  const { error } = await supabase
    .from(tables.PERSONAL_BOOKS_TBL)
    .update(updateData)
    .eq("id", bookId)
    .eq("user_id", user.data.user.id);

  if (error) throw error;

  return { message: "Book updated successfully" };
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

    const { data, error } = await supabase
      .from(tables.PERSONAL_BOOKS_TBL)
      .select(BOOK_SELECT)
      .eq("id", bookId)
      .single();

    if (error) throw error;

    return { ...(data as any), expense_count: 0 } as Book;
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
