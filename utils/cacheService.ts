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
  }
};
