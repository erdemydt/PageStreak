import { execute, queryAll } from '../db/db';

/**
 * Migration utility to upgrade from basic books schema to enhanced books schema
 * This runs automatically in the app, but can also be run manually if needed
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
        date_added TEXT DEFAULT CURRENT_TIMESTAMP,
        date_started TEXT,
        date_finished TEXT,
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
