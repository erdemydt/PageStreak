import { createGoalHistoryTable, createReadingSessionsIndexes, execute, resetInitializationFlag } from '../db/db';
import NotificationService from '../services/notificationService';
import { log, warn } from './logger';

/**
 * Logout user - resets all data and removes user preferences
 * WARNING: This will delete all data!
 */
export const logoutUser = async () => {
  log('👋 Logging out user - ALL DATA WILL BE LOST!');
  
  try {
    // Cancel any scheduled notifications before clearing data
    try {
      await NotificationService.cleanup();
      log('📵 Cancelled scheduled notifications');
    } catch (notifError) {
      warn('⚠️  Could not cancel notifications:', notifError);
    }

    // Drop all user data tables
    await execute('DROP TABLE IF EXISTS enhanced_books');
    await execute('DROP TABLE IF EXISTS books');
    await execute('DROP TABLE IF EXISTS user_preferences');
    await execute('DROP TABLE IF EXISTS reading_sessions');
    await execute('DROP TABLE IF EXISTS weekly_progress');
    await execute('DROP TABLE IF EXISTS notification_preferences');
    await execute('DROP TABLE IF EXISTS app_usage_tracking');
    await execute('DROP TABLE IF EXISTS database_version');
    await execute('DROP TABLE IF EXISTS goal_history');
    
    log('🗑️  All user data cleared');
    
    // Only recreate empty table structures without default data
    await execute(`
      CREATE TABLE IF NOT EXISTS enhanced_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        author TEXT NOT NULL,
        page INTEGER NOT NULL,
        isbn TEXT,
        cover_id INTEGER,
        cover_url TEXT,
        first_publish_year INTEGER,
        publisher TEXT,
        language TEXT DEFAULT 'eng',
        description TEXT,
        subjects TEXT,
        open_library_key TEXT,
        author_key TEXT,
        rating REAL,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
        date_started DATETIME,
        date_finished DATETIME,
        current_page INTEGER DEFAULT 0,
        reading_status TEXT DEFAULT 'want_to_read',
        notes TEXT
      )
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL DEFAULT 'Reader',
        yearly_book_goal INTEGER DEFAULT 12,
        preferred_genres TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        weekly_reading_goal INTEGER,
        initial_reading_rate_minutes_per_day INTEGER,
        end_reading_rate_goal_minutes_per_day INTEGER,
        end_reading_rate_goal_date TEXT,
        current_reading_rate_minutes_per_day INTEGER,
        current_reading_rate_last_updated TEXT,
        weekly_reading_rate_increase_minutes INTEGER,
        weekly_reading_rate_increase_minutes_percentage REAL
      )
    `);

    // Recreate notification tables with clean state
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

    await execute(`
      CREATE TABLE IF NOT EXISTS app_usage_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_opened_at DATETIME NOT NULL,
        last_closed_at DATETIME,
        session_count_today INTEGER DEFAULT 1,
        date TEXT NOT NULL
      )
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS reading_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        minutes_read INTEGER NOT NULL,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        pages_read INTEGER
      )
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS weekly_progress (
        id INTEGER PRIMARY KEY,
        weeks_passed INTEGER NOT NULL DEFAULT 0,
        target_reading_minutes INTEGER NOT NULL DEFAULT 210,
        achived_reading_minutes INTEGER NOT NULL DEFAULT 0,
        date_created DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await createReadingSessionsIndexes();
    await createGoalHistoryTable();

    // Recreate database version table
    await execute(`
      CREATE TABLE IF NOT EXISTS database_version (
        id INTEGER PRIMARY KEY,
        version INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Reset database initialization flag so it can be re-initialized
    resetInitializationFlag();
    
    log('🎉 User logout completed!');
    return true;
  } catch (error) {
    console.error('❌ Logout failed:', error);
    throw error;
  }
};
