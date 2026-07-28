import { Book } from "@/types/books";
import { tables } from "@/utils/constants";
import { isUniqueViolation, supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { ImagePickerSuccessResult } from "expo-image-picker";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

// NOTE (slice #1 — foundation): these are the ONLINE paths only. Offline
// queueing + cached read-fallback (mirroring group.service) land in slice #5,
// where the offlineQueue/cacheService book helpers are added.

const BOOK_SELECT = `id, created_at, user_id, name, category, avatar, currency, budget, archived, group_id`;

export const saveBook = async ({
  name,
  category,
  avatar,
  currency,
  user_id,
  id
}: {
  name: string;
  category: string;
  avatar: ImagePickerSuccessResult | null;
  currency: string;
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
      currency: currency || "PHP"
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
    avatar: ImagePickerSuccessResult | null;
  }
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { name, category, currency, avatar } = payload;

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
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const from = page * BOOKS_PAGE_SIZE;
  const to = from + BOOKS_PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from(tables.PERSONAL_BOOKS_TBL)
    .select(`${BOOK_SELECT}, expenses:${tables.PERSONAL_EXPENSES_TBL}(count)`, {
      count: "exact"
    })
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

  return {
    data: books,
    hasNext: page < totalPages - 1
  };
};

export const getBookById = async (bookId: string): Promise<Book> => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from(tables.PERSONAL_BOOKS_TBL)
    .select(BOOK_SELECT)
    .eq("id", bookId)
    .single();

  if (error) throw error;

  return { ...(data as any), expense_count: 0 } as Book;
};

export const archiveBook = async (bookId: string) => {
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
