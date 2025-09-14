import { execute, queryAll } from '../db/db';

/**
 * Migration utility to upgrade from basic books schema to enhanced books schema
 * This is now integrated into the main database initialization in db.tsx
 * This file can still be used for manual migrations or testing purposes
 */
export const runMigration = async () => {
  try {
    console.log('🔄 Starting database migration...');

    // Step 1: Create the new enhanced_books table
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

    // Step 2: Check if old books table exists and migrate data
    try {
      const oldBooks = await queryAll<{id: number, name: string, author: string, page: number}>('SELECT * FROM books');
      
      if (oldBooks.length > 0) {
        console.log(`📚 Found ${oldBooks.length} books to migrate`);
        
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
        
        // Step 3: Optionally backup and drop old table
        // Note: Uncomment the lines below if you want to remove the old table after migration
        // await execute('CREATE TABLE books_backup AS SELECT * FROM books');
        // await execute('DROP TABLE books');
        
        console.log('🎉 Migration completed successfully!');
      } else {
        console.log('📚 No books found in old table, migration not needed');
      }
    } catch (error) {
      console.log('📚 Old books table not found, starting fresh');
    }

    // Step 4: Create user_preferences table if it doesn't exist
    await execute(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL DEFAULT 'Reader',
        yearly_book_goal INTEGER DEFAULT 12,
        preferred_genres TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default user preferences if none exist
    const existingUser = await queryAll('SELECT id FROM user_preferences WHERE id = 1');
    if (existingUser.length === 0) {
      await execute(`
        INSERT INTO user_preferences (id, username, yearly_book_goal)
        VALUES (1, 'Reader', 12)
      `);
      console.log('👤 Created default user preferences');
    }

    console.log('✨ Database setup completed!');
    return true;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

/**
 * Reset database - useful for development/testing
 * WARNING: This will delete all data!
 */
export const resetDatabase = async () => {
  console.log('⚠️  RESETTING DATABASE - ALL DATA WILL BE LOST!');
  
  try {
    await execute('DROP TABLE IF EXISTS enhanced_books');
    await execute('DROP TABLE IF EXISTS books');
    await execute('DROP TABLE IF EXISTS user_preferences');
    await execute('DROP TABLE IF EXISTS reading_sessions');
    await execute('DROP TABLE IF EXISTS weekly_progress');
    await execute('DROP TABLE IF EXISTS notification_preferences');
    await execute('DROP TABLE IF EXISTS app_usage_tracking');
    await execute('DROP TABLE IF EXISTS database_version');
    
    console.log('🗑️  All tables dropped');
    
    // Recreate tables
    await runMigration();
    
    console.log('🎉 Database reset completed!');
    return true;
  } catch (error) {
    console.error('❌ Reset failed:', error);
    throw error;
  }
};

/**
 * Logout user - resets all data and removes user preferences
 * WARNING: This will delete all data!
 */
export const logoutUser = async () => {
  console.log('👋 Logging out user - ALL DATA WILL BE LOST!');
  
  try {
    // Cancel any scheduled notifications before clearing data
    try {
      const NotificationService = (await import('../services/notificationService')).default;
      await NotificationService.cleanup();
      console.log('📵 Cancelled scheduled notifications');
    } catch (notifError) {
      console.warn('⚠️  Could not cancel notifications:', notifError);
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
    
    console.log('🗑️  All user data cleared');
    
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
        notes TEXT
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

    // Recreate database version table
    await execute(`
      CREATE TABLE IF NOT EXISTS database_version (
        id INTEGER PRIMARY KEY,
        version INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Reset database initialization flag so it can be re-initialized
    const { resetInitializationFlag } = await import('../db/db');
    resetInitializationFlag();
    
    console.log('🎉 User logout completed!');
    return true;
  } catch (error) {
    console.error('❌ Logout failed:', error);
    throw error;
  }
};

/**
 * Get migration status
 */
export const getMigrationStatus = async () => {
  try {
    const enhancedBooks = await queryAll('SELECT COUNT(*) as count FROM enhanced_books');
    const enhancedCount = enhancedBooks[0]?.count || 0;
    
    let oldCount = 0;
    try {
      const oldBooks = await queryAll('SELECT COUNT(*) as count FROM books');
      oldCount = oldBooks[0]?.count || 0;
    } catch (e) {
      // Old table doesn't exist
    }
    
    return {
      enhanced_books_count: enhancedCount,
      old_books_count: oldCount,
      migration_needed: oldCount > 0 && enhancedCount === 0,
    };
  } catch (error) {
    console.error('Failed to get migration status:', error);
    return null;
  }
};
