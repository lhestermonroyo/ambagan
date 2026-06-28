import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("ambagan_offline.db");
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS cache_groups_list (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_group_detail (
      group_id TEXT PRIMARY KEY,
      expense_list TEXT NOT NULL,
      member_list TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_payments (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_friends (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_favorites (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_user_stats (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_group_settlements (
      group_id TEXT PRIMARY KEY,
      active TEXT NOT NULL,
      settled TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_friend_settlements (
      friend_id TEXT PRIMARY KEY,
      active TEXT NOT NULL,
      settled TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_expense_detail (
      expense_id TEXT PRIMARY KEY,
      expense_json TEXT NOT NULL,
      payer_list_json TEXT NOT NULL,
      member_splits_json TEXT NOT NULL,
      payment_splits_json TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );
  `);
  return _db;
}
