import { PersonalOverview } from "@/types/books";
import { getDb } from "./offlineDb";

export const cacheService = {
  async saveGroupsList(userId: string, data: any[]): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_groups_list (user_id, data, cached_at) VALUES (?, ?, ?)",
      [userId, JSON.stringify(data), Date.now()]
    );
  },

  async getGroupsList(userId: string): Promise<any[] | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      "SELECT data FROM cache_groups_list WHERE user_id = ?",
      [userId]
    );
    return row ? JSON.parse(row.data) : null;
  },

  async saveGroupDetail(
    groupId: string,
    expenseList: any[],
    memberList: any[]
  ): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_group_detail (group_id, expense_list, member_list, cached_at) VALUES (?, ?, ?, ?)",
      [groupId, JSON.stringify(expenseList), JSON.stringify(memberList), Date.now()]
    );
  },

  async getGroupDetail(
    groupId: string
  ): Promise<{ expenseList: any[]; memberList: any[] } | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{
      expense_list: string;
      member_list: string;
    }>(
      "SELECT expense_list, member_list FROM cache_group_detail WHERE group_id = ?",
      [groupId]
    );
    if (!row) return null;
    return {
      expenseList: JSON.parse(row.expense_list),
      memberList: JSON.parse(row.member_list)
    };
  },

  async savePayments(userId: string, data: any[]): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_payments (user_id, data, cached_at) VALUES (?, ?, ?)",
      [userId, JSON.stringify(data), Date.now()]
    );
  },

  async getPayments(userId: string): Promise<any[] | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      "SELECT data FROM cache_payments WHERE user_id = ?",
      [userId]
    );
    return row ? JSON.parse(row.data) : null;
  },

  async saveFriends(userId: string, data: any[]): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_friends (user_id, data, cached_at) VALUES (?, ?, ?)",
      [userId, JSON.stringify(data), Date.now()]
    );
  },

  async getFriends(userId: string): Promise<any[] | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      "SELECT data FROM cache_friends WHERE user_id = ?",
      [userId]
    );
    return row ? JSON.parse(row.data) : null;
  },

  async saveFavorites(userId: string, data: any[]): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_favorites (user_id, data, cached_at) VALUES (?, ?, ?)",
      [userId, JSON.stringify(data), Date.now()]
    );
  },

  async getFavorites(userId: string): Promise<any[] | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      "SELECT data FROM cache_favorites WHERE user_id = ?",
      [userId]
    );
    return row ? JSON.parse(row.data) : null;
  },

  async saveGroupContacts(userId: string, data: any[]): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_group_contacts (user_id, data, cached_at) VALUES (?, ?, ?)",
      [userId, JSON.stringify(data), Date.now()]
    );
  },

  async getGroupContacts(userId: string): Promise<any[] | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      "SELECT data FROM cache_group_contacts WHERE user_id = ?",
      [userId]
    );
    return row ? JSON.parse(row.data) : null;
  },

  async saveStats(userId: string, data: any): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_user_stats (user_id, data, cached_at) VALUES (?, ?, ?)",
      [userId, JSON.stringify(data), Date.now()]
    );
  },

  async getStats(userId: string): Promise<any | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      "SELECT data FROM cache_user_stats WHERE user_id = ?",
      [userId]
    );
    return row ? JSON.parse(row.data) : null;
  },

  async saveNotifications(userId: string, data: any[]): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_notifications (user_id, data, cached_at) VALUES (?, ?, ?)",
      [userId, JSON.stringify(data), Date.now()]
    );
  },

  async getNotifications(userId: string): Promise<any[] | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      "SELECT data FROM cache_notifications WHERE user_id = ?",
      [userId]
    );
    return row ? JSON.parse(row.data) : null;
  },

  async saveExpenseDetail(
    expenseId: string,
    expense: any,
    payerList: any[],
    memberSplits: any[],
    paymentSplits: any[]
  ): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_expense_detail (expense_id, expense_json, payer_list_json, member_splits_json, payment_splits_json, cached_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        expenseId,
        JSON.stringify(expense),
        JSON.stringify(payerList),
        JSON.stringify(memberSplits),
        JSON.stringify(paymentSplits),
        Date.now()
      ]
    );
  },

  async getExpenseDetail(expenseId: string): Promise<{
    expense: any;
    payerList: any[];
    memberSplits: any[];
    paymentSplits: any[];
  } | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{
      expense_json: string;
      payer_list_json: string;
      member_splits_json: string;
      payment_splits_json: string;
    }>(
      "SELECT expense_json, payer_list_json, member_splits_json, payment_splits_json FROM cache_expense_detail WHERE expense_id = ?",
      [expenseId]
    );
    if (!row) return null;
    return {
      expense: JSON.parse(row.expense_json),
      payerList: JSON.parse(row.payer_list_json),
      memberSplits: JSON.parse(row.member_splits_json),
      paymentSplits: JSON.parse(row.payment_splits_json)
    };
  },

  async saveGroupSettlements(
    groupId: string,
    active: any[],
    settled: any[]
  ): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_group_settlements (group_id, active, settled, cached_at) VALUES (?, ?, ?, ?)",
      [groupId, JSON.stringify(active), JSON.stringify(settled), Date.now()]
    );
  },

  async getGroupSettlements(
    groupId: string
  ): Promise<{ active: any[]; settled: any[] } | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ active: string; settled: string }>(
      "SELECT active, settled FROM cache_group_settlements WHERE group_id = ?",
      [groupId]
    );
    if (!row) return null;
    return {
      active: JSON.parse(row.active),
      settled: JSON.parse(row.settled)
    };
  },

  async saveFriendSettlements(
    friendId: string,
    active: any[],
    settled: any[]
  ): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_friend_settlements (friend_id, active, settled, cached_at) VALUES (?, ?, ?, ?)",
      [friendId, JSON.stringify(active), JSON.stringify(settled), Date.now()]
    );
  },

  async getFriendSettlements(
    friendId: string
  ): Promise<{ active: any[]; settled: any[] } | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ active: string; settled: string }>(
      "SELECT active, settled FROM cache_friend_settlements WHERE friend_id = ?",
      [friendId]
    );
    if (!row) return null;
    return {
      active: JSON.parse(row.active),
      settled: JSON.parse(row.settled)
    };
  },

  // The user's daily expense-creation count as last read from the server, tagged
  // with the local day it was read on. Read offline (alongside the pending queue)
  // to keep the free-tier daily limit enforced without a live server count.
  async saveDailyExpenseCount(
    userId: string,
    count: number,
    dayKey: string
  ): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_daily_expense_count (user_id, count, day_key, cached_at) VALUES (?, ?, ?, ?)",
      [userId, count, dayKey, Date.now()]
    );
  },

  async getDailyExpenseCount(
    userId: string
  ): Promise<{ count: number; dayKey: string } | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ count: number; day_key: string }>(
      "SELECT count, day_key FROM cache_daily_expense_count WHERE user_id = ?",
      [userId]
    );
    if (!row) return null;
    return { count: row.count, dayKey: row.day_key };
  },

  // ---- Personal books (offline "Books" feature) ----------------------------

  async saveBooksList(userId: string, data: any[]): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_books_list (user_id, data, cached_at) VALUES (?, ?, ?)",
      [userId, JSON.stringify(data), Date.now()]
    );
  },

  async getBooksList(userId: string): Promise<any[] | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      "SELECT data FROM cache_books_list WHERE user_id = ?",
      [userId]
    );
    return row ? JSON.parse(row.data) : null;
  },

  async saveBookDetail(
    bookId: string,
    book: any,
    expenseList: any[],
    totals: any[]
  ): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_book_detail (book_id, book_json, expense_list, totals, cached_at) VALUES (?, ?, ?, ?, ?)",
      [
        bookId,
        JSON.stringify(book),
        JSON.stringify(expenseList),
        JSON.stringify(totals),
        Date.now()
      ]
    );
  },

  async getBookDetail(
    bookId: string
  ): Promise<{ book: any; expenseList: any[]; totals: any[] } | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{
      book_json: string;
      expense_list: string;
      totals: string;
    }>(
      "SELECT book_json, expense_list, totals FROM cache_book_detail WHERE book_id = ?",
      [bookId]
    );
    if (!row) return null;
    return {
      book: JSON.parse(row.book_json),
      expenseList: JSON.parse(row.expense_list),
      totals: JSON.parse(row.totals)
    };
  },

  // The user's daily personal-expense count as last read from the server (see
  // saveDailyExpenseCount) — a SEPARATE bucket from group expenses.
  async saveDailyPersonalCount(
    userId: string,
    count: number,
    dayKey: string
  ): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_daily_personal_count (user_id, count, day_key, cached_at) VALUES (?, ?, ?, ?)",
      [userId, count, dayKey, Date.now()]
    );
  },

  async getDailyPersonalCount(
    userId: string
  ): Promise<{ count: number; dayKey: string } | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ count: number; day_key: string }>(
      "SELECT count, day_key FROM cache_daily_personal_count WHERE user_id = ?",
      [userId]
    );
    if (!row) return null;
    return { count: row.count, dayKey: row.day_key };
  },

  // The Overview personal-spending card's whole payload — this month, last
  // month to date, and budget usage — as last read from the server, so the card
  // shows its last value offline. The table name predates the card carrying
  // more than a monthly total; a row written by an older build holds a bare
  // totals array, which getPersonalOverview below discards rather than
  // half-reads.
  async savePersonalOverview(
    userId: string,
    data: PersonalOverview
  ): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_personal_monthly (user_id, data, cached_at) VALUES (?, ?, ?)",
      [userId, JSON.stringify(data), Date.now()]
    );
  },

  async getPersonalOverview(userId: string): Promise<PersonalOverview | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      "SELECT data FROM cache_personal_monthly WHERE user_id = ?",
      [userId]
    );
    if (!row) return null;
    const parsed = JSON.parse(row.data);
    // Legacy shape (a PersonalBookTotal[]) — no comparison or budgets in it, so
    // there's nothing to salvage; the next successful fetch overwrites it.
    if (!parsed || Array.isArray(parsed) || !Array.isArray(parsed.thisMonth)) {
      return null;
    }
    return parsed as PersonalOverview;
  },

  /** FX rates are global, so this is a single-row table (see utils/fx.ts). */
  async saveFxRates(data: {
    rates: Record<string, number>;
    asOfByCurrency: Record<string, string>;
    asOf: string;
  }): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO cache_fx_rates (id, data, cached_at) VALUES (1, ?, ?)",
      [JSON.stringify(data), Date.now()]
    );
  },

  async getFxRates(): Promise<{
    rates: Record<string, number>;
    /** Absent in caches written before per-currency dates existed. */
    asOfByCurrency: Record<string, string>;
    asOf: string;
  } | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      "SELECT data FROM cache_fx_rates WHERE id = 1"
    );
    return row ? JSON.parse(row.data) : null;
  }
};
