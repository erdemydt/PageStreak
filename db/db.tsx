import { openDatabaseSync, SQLiteDatabase, SQLiteExecuteAsyncResult } from 'expo-sqlite';
import type { SQLiteRunResult } from 'expo-sqlite';
import { log } from '../utils/logger';

// Open or create a local SQLite database
const db: SQLiteDatabase = openDatabaseSync('pagestreak.db');
// Wait briefly instead of failing with "database is locked" while another
// connection (e.g. the backup import's exclusive transaction) holds the lock
db.execSync('PRAGMA busy_timeout = 3000');

export type DB = SQLiteDatabase;
export type DBResult<T = any> = SQLiteExecuteAsyncResult<T>;

// Type for column definitions
type ColumnDefinition = {
  name: string;
  type: string;
  default?: string;
};

// Domain types live in types/models.ts; re-exported here for existing imports
export type {
  AppUsageTracking,
  DailyProgress,
  EnhancedBook,
  NotificationPreferences,
  ReadingSession,
} from '../types/models';

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
export async function execute(sql: string, params?: any): Promise<SQLiteRunResult> {
  return db.runAsync(sql, params ?? []);
}

let transactionQueue: Promise<unknown> = Promise.resolve();

/**
 * Run `task` in a transaction on the shared connection. ALWAYS use this
 * instead of db.withTransactionAsync: that one runs BEGIN/COMMIT on the shared
 * connection without coordination, so two overlapping calls corrupt each
 * other (the second BEGIN fails and its ROLLBACK undoes the first one's work,
 * which then continues in autocommit). Transactions here run one at a time.
 * Never call runInTransaction from inside a task (it would wait for itself).
 */
export function runInTransaction<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    await db.execAsync('BEGIN');
    try {
      const result = await task();
      await db.execAsync('COMMIT');
      return result;
    } catch (error) {
      // SQLite may already have rolled back (e.g. disk full); keep the
      // original error rather than a "no transaction is active" one
      try {
        await db.execAsync('ROLLBACK');
      } catch {}
      throw error;
    }
  };
  const result = transactionQueue.then(run, run);
  transactionQueue = result.catch(() => {});
  return result;
}

/**
 * Schema migrations, tracked with SQLite's `PRAGMA user_version`.
 *
 * Rules: append new migrations with the next version number; never edit,
 * reorder or remove a shipped one. Each runs once, inside a transaction
 * together with the user_version bump, so a failure leaves the database at
 * the previous version and it is retried on the next launch.
 *
 * Migration 4 is the baseline. Before it, the schema was created by idempotent
 * "create or add missing columns" steps on every launch (versions 1-3 in the
 * old database_version table, or just the legacy `books` table). Running those
 * same steps once brings any earlier install, or a fresh one, to the current
 * schema, so later migrations can rely on it.
 */
type Migration = {
  version: number;
  description: string;
  up: () => Promise<void>;
};

const MIGRATIONS: Migration[] = [
  {
    version: 4,
    description: 'Baseline schema (idempotent; safe for any earlier install)',
    up: async () => {
      await createOrUpdateEnhancedBooksTable();
      await createOrUpdateUserPreferencesTable();
      await createOrUpdateReadingSessionsTable();
      await createOrUpdateWeeklyProgressTable();
      await createOrUpdateNotificationPreferencesTable();
      await createOrUpdateAppUsageTrackingTable();
      await createGoalHistoryTable();
      await migrateOldBooksIfNeeded();
    },
  },
];

export const LATEST_DB_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

let initPromise: Promise<void> | null = null;

/**
 * Bring the database schema up to date. Everything that touches the database
 * at startup awaits this first (root layout, boot screen). Concurrent callers
 * share one run; after a failure the next call retries.
 */
export function initializeDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = runMigrations().catch((error) => {
      initPromise = null;
      console.error('❌ Database initialization failed:', error);
      throw error;
    });
  }
  return initPromise;
}

async function runMigrations(): Promise<void> {
  const row = await queryFirst<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    log(`🔄 Running migration ${migration.version}: ${migration.description}`);
    await runInTransaction(async () => {
      await migration.up();
      // PRAGMA can't take bound parameters; version is a trusted integer
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }

  log(`✅ Database at schema version ${Math.max(currentVersion, LATEST_DB_VERSION)}`);
}

/**
 * Helper function to check if a column exists in a table
 */
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await queryAll(`PRAGMA table_info(${tableName})`);
    return result.some((column: any) => column.name === columnName);
  } catch {
    // Table might not exist yet
    return false;
  }
}

/**
 * Create or update enhanced_books table with all required columns
 */
async function createOrUpdateEnhancedBooksTable(): Promise<void> {
  // Create table if it doesn't exist
  await execute(`
    CREATE TABLE IF NOT EXISTS enhanced_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      author TEXT NOT NULL,
      page INTEGER NOT NULL
    )
  `);

  // Define all required columns with their types and defaults
  const requiredColumns: ColumnDefinition[] = [
    { name: 'isbn', type: 'TEXT' },
    { name: 'cover_id', type: 'INTEGER' },
    { name: 'cover_url', type: 'TEXT' },
    { name: 'first_publish_year', type: 'INTEGER' },
    { name: 'publisher', type: 'TEXT' },
    { name: 'language', type: 'TEXT', default: "'eng'" },
    { name: 'description', type: 'TEXT' },
    { name: 'subjects', type: 'TEXT' },
    { name: 'open_library_key', type: 'TEXT' },
    { name: 'author_key', type: 'TEXT' },
    { name: 'rating', type: 'REAL' },
    { name: 'date_added', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    { name: 'date_started', type: 'DATETIME' },
    { name: 'date_finished', type: 'DATETIME' },
    { name: 'current_page', type: 'INTEGER', default: '0' },
    { name: 'reading_status', type: 'TEXT', default: "'want_to_read'" },
    { name: 'notes', type: 'TEXT' }
  ];

  // Add missing columns
  for (const column of requiredColumns) {
    if (!(await columnExists('enhanced_books', column.name))) {
      const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
      await execute(`ALTER TABLE enhanced_books ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
      log(`✅ Added column: enhanced_books.${column.name}`);
    }
  }
}

/**
 * Create or update user_preferences table with all required columns
 */
async function createOrUpdateUserPreferencesTable(): Promise<void> {
  // Create table if it doesn't exist
  await execute(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL DEFAULT 'Reader',
      yearly_book_goal INTEGER DEFAULT 12
    )
  `);

  // Define all required columns
  const requiredColumns: ColumnDefinition[] = [
    { name: 'preferred_genres', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT', default: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'TEXT', default: 'CURRENT_TIMESTAMP' },
    { name: 'weekly_reading_goal', type: 'INTEGER' },
    { name: 'initial_reading_rate_minutes_per_day', type: 'INTEGER' },
    { name: 'end_reading_rate_goal_minutes_per_day', type: 'INTEGER' },
    { name: 'end_reading_rate_goal_date', type: 'TEXT' },
    { name: 'current_reading_rate_minutes_per_day', type: 'INTEGER' },
    { name: 'current_reading_rate_last_updated', type: 'TEXT' },
    { name: 'weekly_reading_rate_increase_minutes', type: 'INTEGER' },
    { name: 'weekly_reading_rate_increase_minutes_percentage', type: 'REAL' }
  ];

  // Add missing columns
  for (const column of requiredColumns) {
    if (!(await columnExists('user_preferences', column.name))) {
      const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
      await execute(`ALTER TABLE user_preferences ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
      log(`✅ Added column: user_preferences.${column.name}`);
    }
  }
}

/**
 * Create or update reading_sessions table with all required columns
 */
async function createOrUpdateReadingSessionsTable(): Promise<void> {
  // Create table if it doesn't exist
  await execute(`
    CREATE TABLE IF NOT EXISTS reading_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      minutes_read INTEGER NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Define all required columns
  const requiredColumns: ColumnDefinition[] = [
    { name: 'notes', type: 'TEXT' },
    { name: 'pages_read', type: 'INTEGER' } // New optional column for pages read in this session
  ];

  // Add missing columns
  for (const column of requiredColumns) {
    if (!(await columnExists('reading_sessions', column.name))) {
      const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
      await execute(`ALTER TABLE reading_sessions ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
      log(`✅ Added column: reading_sessions.${column.name}`);
    }
  }

  await createReadingSessionsIndexes();

  // Note: Foreign key constraint for reading_sessions.book_id -> enhanced_books.id 
  // is enforced at the application level (SQLite limitations with existing tables)
}

async function createReadingSessionsIndexes(): Promise<void> {
  await execute('CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON reading_sessions(book_id)');
  await execute('CREATE INDEX IF NOT EXISTS idx_reading_sessions_date ON reading_sessions(date)');
}

async function createGoalHistoryTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS goal_history (
      effective_date TEXT PRIMARY KEY,
      minutes INTEGER NOT NULL
    )
  `);
}

/**
 * Create or update weekly_progress table with all required columns
 */
async function createOrUpdateWeeklyProgressTable(): Promise<void> {
  // Create table if it doesn't exist
  await execute(`
    CREATE TABLE IF NOT EXISTS weekly_progress (
      id INTEGER PRIMARY KEY,
      weeks_passed INTEGER NOT NULL DEFAULT 0,
      target_reading_minutes INTEGER NOT NULL DEFAULT 210,
      achived_reading_minutes INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Define all required columns
  const requiredColumns: ColumnDefinition[] = [
    { name: 'date_created', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
  ];

  // Add missing columns
  for (const column of requiredColumns) {
    if (!(await columnExists('weekly_progress', column.name))) {
      const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
      await execute(`ALTER TABLE weekly_progress ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
      log(`✅ Added column: weekly_progress.${column.name}`);
    }
  }
}

/**
 * Create or update notification_preferences table with all required columns
 */
async function createOrUpdateNotificationPreferencesTable(): Promise<void> {
  // Create table if it doesn't exist
  await execute(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY,
      notifications_enabled BOOLEAN DEFAULT 1,
      daily_reminder_enabled BOOLEAN DEFAULT 1,
      daily_reminder_hours_after_last_open INTEGER DEFAULT 5,
      daily_reminder_title TEXT DEFAULT 'Time to read! 📚',
      daily_reminder_body TEXT DEFAULT 'You haven''t reached your daily reading goal yet. Keep your streak going!',
      reminder_mode TEXT DEFAULT 'after_close',
      reminder_time TEXT DEFAULT '20:00',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Define all required columns with their types and defaults
  const requiredColumns: ColumnDefinition[] = [
    { name: 'notifications_enabled', type: 'BOOLEAN', default: '1' },
    { name: 'daily_reminder_enabled', type: 'BOOLEAN', default: '1' },
    { name: 'daily_reminder_hours_after_last_open', type: 'INTEGER', default: '5' },
    { name: 'daily_reminder_title', type: 'TEXT', default: "'Time to read! 📚'" },
    { name: 'daily_reminder_body', type: 'TEXT', default: "'You haven''t reached your daily reading goal yet. Keep your streak going!'" },
    { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    // 'after_close': N hours after leaving the app; 'daily_time': at reminder_time (HH:MM)
    { name: 'reminder_mode', type: 'TEXT', default: "'after_close'" },
    { name: 'reminder_time', type: 'TEXT', default: "'20:00'" }
  ];

  // Add missing columns
  for (const column of requiredColumns) {
    if (!(await columnExists('notification_preferences', column.name))) {
      const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
      await execute(`ALTER TABLE notification_preferences ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
      log(`✅ Added column: notification_preferences.${column.name}`);
    }
  }

  log('✅ Created/verified notification_preferences table');
}

/**
 * Create or update app_usage_tracking table with all required columns
 */
async function createOrUpdateAppUsageTrackingTable(): Promise<void> {
  // Create table if it doesn't exist
  await execute(`
    CREATE TABLE IF NOT EXISTS app_usage_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      last_opened_at DATETIME NOT NULL,
      last_closed_at DATETIME,
      session_count_today INTEGER DEFAULT 1,
      date TEXT NOT NULL
    )
  `);

  // Define all required columns with their types and defaults
  const requiredColumns: ColumnDefinition[] = [
    { name: 'last_opened_at', type: 'DATETIME' },
    { name: 'last_closed_at', type: 'DATETIME' },
    { name: 'session_count_today', type: 'INTEGER', default: '1' },
    { name: 'date', type: 'TEXT' }
  ];

  // Add missing columns
  for (const column of requiredColumns) {
    if (!(await columnExists('app_usage_tracking', column.name))) {
      const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
      await execute(`ALTER TABLE app_usage_tracking ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
      log(`✅ Added column: app_usage_tracking.${column.name}`);
    }
  }

  // Create index for faster queries by date
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_app_usage_date ON app_usage_tracking(date)
  `);

  log('✅ Created/verified app_usage_tracking table');
}

/**
 * Migrate data from old 'books' table to 'enhanced_books' table if needed
 */
async function migrateOldBooksIfNeeded(): Promise<void> {
  try {
    // Check if old books table exists and has data
    const oldBooks = await queryAll<{id: number, name: string, author: string, page: number}>('SELECT * FROM books');
    
    if (oldBooks.length > 0) {
      log(`📚 Found ${oldBooks.length} books to migrate from old table`);
      
      for (const book of oldBooks) {
        // Check if book already exists in enhanced_books
        const existing = await queryAll('SELECT id FROM enhanced_books WHERE name = ? AND author = ?', [book.name, book.author]);
        
        if (existing.length === 0) {
          await execute(`
            INSERT INTO enhanced_books (
              name, author, page, reading_status, date_added, current_page, date_finished
            ) VALUES (?, ?, ?, 'read', datetime('now'), ?, datetime('now'))
          `, [book.name, book.author, book.page, book.page]);
          
          log(`✅ Migrated: ${book.name} by ${book.author}`);
        }
      }
      
      log('🎉 Book migration completed successfully!');
    }
  } catch {
    // Old books table doesn't exist, which is fine for new installations
    log('📚 No old books table found, starting fresh');
  }
}

export default db;
