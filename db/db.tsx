import { openDatabaseSync, SQLiteDatabase, SQLiteExecuteAsyncResult } from 'expo-sqlite';

// Open or create a local SQLite database
const db: SQLiteDatabase = openDatabaseSync('pagestreak.db');

export type DB = SQLiteDatabase;
export type DBResult<T = any> = SQLiteExecuteAsyncResult<T>;

// Enhanced Book type with Open Library API fields
export type EnhancedBook = {
  id: number;
  name: string;
  author: string;
  page: number;
  // Open Library API fields
  isbn?: string;
  cover_id?: number;
  cover_url?: string;
  first_publish_year?: number;
  publisher?: string;
  language?: string;
  description?: string;
  subjects?: string;
  open_library_key?: string;
  author_key?: string;
  rating?: number;
  date_added?: string;
  date_started?: string;
  date_finished?: string;
  current_page?: number;
  reading_status?: 'want_to_read' | 'currently_reading' | 'read';
  notes?: string;
};

/**
 * Helper to run a SQL query with parameters and get all results as array.
 * @param sql SQL query string
 * @param params Query parameters (array or object)
 */
export async function queryAll<T = any>(sql: string, params?: any): Promise<T[]> {
  return db.getAllAsync<T>(sql, params ?? []);
}

/**
 * Helper to run a SQL query with parameters and get the first result (or null).
 * @param sql SQL query string
 * @param params Query parameters (array or object)
 */
export async function queryFirst<T = any>(sql: string, params?: any): Promise<T | null> {
  return db.getFirstAsync<T>(sql, params ?? []);
}

/**
 * Helper to run a SQL statement (insert, update, delete).
 * @param sql SQL statement
 * @param params Query parameters (array or object)
 */
import type { SQLiteRunResult } from 'expo-sqlite';
export async function execute(sql: string, params?: any): Promise<SQLiteRunResult> {
  return db.runAsync(sql, params ?? []);
}

export default db;
