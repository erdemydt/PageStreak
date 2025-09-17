import { openDatabaseSync, SQLiteDatabase, SQLiteExecuteAsyncResult } from 'expo-sqlite';

// Open or create a local SQLite database
const db: SQLiteDatabase = openDatabaseSync('pagestreak.db');

export type DB = SQLiteDatabase;
export type DBResult<T = any> = SQLiteExecuteAsyncResult<T>;

// Database initialization flag to prevent multiple calls
let isInitialized = false;

// Current database schema version
const CURRENT_DB_VERSION = 3;

// Type for column definitions
type ColumnDefinition = {
  name: string;
  type: string;
  default?: string;
};

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

// Reading Session type for tracking daily reading progress
export type ReadingSession = {
  id: number;
  book_id: number;
  minutes_read: number;
  pages_read?: number; // Optional: pages read in this session
  date: string; // YYYY-MM-DD format
  created_at: string;
  notes?: string;
};

// Daily reading progress summary
export type DailyProgress = {
  date: string;
  total_minutes: number;
  goal_minutes: number;
  percentage: number;
  sessions_count: number;
};

// Notification preferences type
export type NotificationPreferences = {
  id: number;
  notifications_enabled: boolean;
  daily_reminder_enabled: boolean;
  daily_reminder_hours_after_last_open: number;
  daily_reminder_title: string;
  daily_reminder_body: string;
  created_at: string;
  updated_at: string;
};

// App usage tracking type
export type AppUsageTracking = {
  id: number;
  last_opened_at: string;
  last_closed_at?: string;
  session_count_today: number;
  date: string; // YYYY-MM-DD format
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

/**
 * Initialize all database tables and ensure proper setup
 * This should be called when the app first starts
 */
export async function initializeDatabase(): Promise<void> {
  if (isInitialized) {
    console.log('📦 Database already initialized, skipping...');
    return;
  }

  try {
    console.log('🔄 Initializing database tables...');

    // 0. Create database version tracking table and check version
    await createOrUpdateDatabaseVersionTable();
    const needsUpdate = await checkDatabaseVersion();

    if (!needsUpdate && isInitialized) {
      console.log('📦 Database is up to date, skipping initialization...');
      return;
    }

    // 1. Create and update enhanced_books table
    await createOrUpdateEnhancedBooksTable();

    // 2. Create and update user_preferences table
    await createOrUpdateUserPreferencesTable();

    // 3. Create and update reading_sessions table
    await createOrUpdateReadingSessionsTable();

    // 4. Create and update weekly_progress table
    await createOrUpdateWeeklyProgressTable();

    // 5. Create and update notification_preferences table
    await createOrUpdateNotificationPreferencesTable();

    // 6. Create and update app_usage_tracking table
    await createOrUpdateAppUsageTrackingTable();

    // 7. Migrate old books if they exist (from legacy 'books' table)
    await migrateOldBooksIfNeeded();

    // 8. Update database version
    await updateDatabaseVersion();

    isInitialized = true;
    console.log('✅ Database initialization completed successfully');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Create or update database version tracking table
 */
async function createOrUpdateDatabaseVersionTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS database_version (
      id INTEGER PRIMARY KEY,
      version INTEGER NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Check if database needs updating based on version
 */
async function checkDatabaseVersion(): Promise<boolean> {
  try {
    const versionRecord = await queryFirst<{version: number}>('SELECT version FROM database_version WHERE id = 1');
    
    if (!versionRecord) {
      console.log('📝 No version record found, treating as new installation');
      return true; // New installation, needs setup
    }
    
    if (versionRecord.version < CURRENT_DB_VERSION) {
      console.log(`🔄 Database version ${versionRecord.version} < ${CURRENT_DB_VERSION}, updating...`);
      return true; // Needs update
    }
    
    console.log(`✅ Database version ${versionRecord.version} is up to date`);
    return false; // No update needed
    
  } catch (error) {
    console.log('📝 Error checking version, treating as new installation');
    return true; // Treat as new installation if we can't check version
  }
}

/**
 * Update database version after successful initialization
 */
async function updateDatabaseVersion(): Promise<void> {
  await execute(`
    INSERT OR REPLACE INTO database_version (id, version, updated_at)
    VALUES (1, ?, CURRENT_TIMESTAMP)
  `, [CURRENT_DB_VERSION]);
  
  console.log(`📝 Updated database version to ${CURRENT_DB_VERSION}`);
}

/**
 * Helper function to check if a column exists in a table
 */
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await queryAll(`PRAGMA table_info(${tableName})`);
    return result.some((column: any) => column.name === columnName);
  } catch (error) {
    // Table might not exist yet
    return false;
  }
}

/**
 * Helper function to check if a table exists
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await queryFirst(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    return !!result;
  } catch (error) {
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
      console.log(`✅ Added column: enhanced_books.${column.name}`);
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
      console.log(`✅ Added column: user_preferences.${column.name}`);
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
      console.log(`✅ Added column: reading_sessions.${column.name}`);
    }
  }

  // Note: Foreign key constraint for reading_sessions.book_id -> enhanced_books.id 
  // is enforced at the application level (SQLite limitations with existing tables)
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
      console.log(`✅ Added column: weekly_progress.${column.name}`);
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
    { name: 'updated_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
  ];

  // Add missing columns
  for (const column of requiredColumns) {
    if (!(await columnExists('notification_preferences', column.name))) {
      const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
      await execute(`ALTER TABLE notification_preferences ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
      console.log(`✅ Added column: notification_preferences.${column.name}`);
    }
  }

  // Ensure default preferences exist (will handle first-time permission request)
  try {
    const existingPrefs = await queryFirst('SELECT id FROM notification_preferences WHERE id = 1');
    if (!existingPrefs) {
      // Don't create defaults here - let NotificationService handle first-time setup
      // This ensures permission request happens at the right time
      console.log('🔔 No notification preferences found - will be created by NotificationService when needed');
    }
  } catch (error) {
    console.error('⚠️  Failed to check notification preferences:', error);
  }

  console.log('✅ Created/verified notification_preferences table');
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
      console.log(`✅ Added column: app_usage_tracking.${column.name}`);
    }
  }

  // Create index for faster queries by date
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_app_usage_date ON app_usage_tracking(date)
  `);

  console.log('✅ Created/verified app_usage_tracking table');
}

/**
 * Migrate data from old 'books' table to 'enhanced_books' table if needed
 */
async function migrateOldBooksIfNeeded(): Promise<void> {
  try {
    // Check if old books table exists and has data
    const oldBooks = await queryAll<{id: number, name: string, author: string, page: number}>('SELECT * FROM books');
    
    if (oldBooks.length > 0) {
      console.log(`📚 Found ${oldBooks.length} books to migrate from old table`);
      
      for (const book of oldBooks) {
        // Check if book already exists in enhanced_books
        const existing = await queryAll('SELECT id FROM enhanced_books WHERE name = ? AND author = ?', [book.name, book.author]);
        
        if (existing.length === 0) {
          await execute(`
            INSERT INTO enhanced_books (
              name, author, page, reading_status, date_added, current_page, date_finished
            ) VALUES (?, ?, ?, 'read', datetime('now'), ?, datetime('now'))
          `, [book.name, book.author, book.page, book.page]);
          
          console.log(`✅ Migrated: ${book.name} by ${book.author}`);
        }
      }
      
      console.log('🎉 Book migration completed successfully!');
    }
  } catch (error) {
    // Old books table doesn't exist, which is fine for new installations
    console.log('📚 No old books table found, starting fresh');
  }
}

/**
 * Reset the initialization flag - useful for testing or forced re-initialization
 */
export function resetInitializationFlag(): void {
  isInitialized = false;
}

/**
 * Check notification database integrity
 */
export async function checkNotificationDatabaseIntegrity(): Promise<{
  notification_preferences_exists: boolean;
  app_usage_tracking_exists: boolean;
  notification_preferences_has_defaults: boolean;
  error?: string;
}> {
  try {
    // Check if tables exist
    const notifTable = await queryFirst(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='notification_preferences'"
    );
    const usageTable = await queryFirst(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_usage_tracking'"
    );

    // Check if default preferences exist
    let hasDefaults = false;
    if (notifTable) {
      const defaultPrefs = await queryFirst('SELECT id FROM notification_preferences WHERE id = 1');
      hasDefaults = !!defaultPrefs;
    }

    return {
      notification_preferences_exists: !!notifTable,
      app_usage_tracking_exists: !!usageTable,
      notification_preferences_has_defaults: hasDefaults
    };
  } catch (error) {
    return {
      notification_preferences_exists: false,
      app_usage_tracking_exists: false,
      notification_preferences_has_defaults: false,
      error: error?.toString()
    };
  }
}

/**
 * Repair notification database if needed
 */
export async function repairNotificationDatabase(): Promise<boolean> {
  try {
    console.log('🔧 Repairing notification database...');
    
    // Recreate notification tables
    await createOrUpdateNotificationPreferencesTable();
    await createOrUpdateAppUsageTrackingTable();
    
    console.log('✅ Notification database repaired');
    return true;
  } catch (error) {
    console.error('❌ Failed to repair notification database:', error);
    return false;
  }
}

export default db;
