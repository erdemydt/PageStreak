import { openDatabaseSync, SQLiteDatabase, SQLiteExecuteAsyncResult } from 'expo-sqlite';

// Open or create a local SQLite database
const db: SQLiteDatabase = openDatabaseSync('pagestreak.db');

export type DB = SQLiteDatabase;
export type DBResult<T = any> = SQLiteExecuteAsyncResult<T>;

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
