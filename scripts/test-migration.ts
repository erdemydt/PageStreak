/**
 * Test script to verify database migration and new features work correctly
 * This script tests:
 * 1. Database initialization with new schema
 * 2. Reading sessions with pages_read field
 * 3. Progress calculation functions
 * 4. Backward compatibility with existing data
 */

import { execute, initializeDatabase, queryAll, queryFirst } from '../db/db';
import { getTodayDateString } from '../utils/dateUtils';
import {
    calculateBookProgressFromSessions,
    getEnhancedBookProgress,
    syncBookCurrentPageFromSessions
} from '../utils/readingProgress';

export async function testDatabaseMigration() {
  console.log('🧪 Starting database migration test...');
  
  try {
    // 1. Initialize database with new schema
    console.log('📦 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
    
    // 2. Test creating a test book
    console.log('📚 Creating test book...');
    const bookResult = await execute(
      `INSERT INTO enhanced_books (name, author, page, reading_status, current_page) 
       VALUES (?, ?, ?, ?, ?)`,
      ['Test Migration Book', 'Test Author', 300, 'currently_reading', 50]
    );
    const bookId = bookResult.lastInsertRowId as number;
    console.log(`✅ Created test book with ID: ${bookId}`);
    
    // 3. Test creating reading sessions with pages_read
    console.log('📝 Creating reading sessions with page tracking...');
    const today = getTodayDateString();
    
    // Session 1: 30 minutes, 15 pages
    await execute(
      `INSERT INTO reading_sessions (book_id, minutes_read, pages_read, date, notes) 
       VALUES (?, ?, ?, ?, ?)`,
      [bookId, 30, 15, today, 'First session with page tracking']
    );
    
    // Session 2: 45 minutes, 20 pages
    await execute(
      `INSERT INTO reading_sessions (book_id, minutes_read, pages_read, date, notes) 
       VALUES (?, ?, ?, ?, ?)`,
      [bookId, 45, 20, today, 'Second session with page tracking']
    );
    
    // Session 3: 25 minutes, no pages (to test optional field)
    await execute(
      `INSERT INTO reading_sessions (book_id, minutes_read, date, notes) 
       VALUES (?, ?, ?, ?)`,
      [bookId, 25, today, 'Session without page tracking']
    );
    
    console.log('✅ Created test reading sessions');
    
    // 4. Test progress calculation from sessions
    console.log('📊 Testing progress calculation...');
    const sessionProgress = await calculateBookProgressFromSessions(bookId, 300);
    console.log(`📈 Session-based progress: ${sessionProgress.pagesRead} pages (${sessionProgress.percentage}%)`);
    
    // 5. Test enhanced progress calculation
    const enhancedProgress = await getEnhancedBookProgress(bookId, 300, 50);
    console.log(`📈 Enhanced progress: ${enhancedProgress.pagesRead} pages (${enhancedProgress.percentage}%) - Source: ${enhancedProgress.source}`);
    
    // 6. Test syncing current_page from sessions
    console.log('🔄 Testing current_page sync...');
    await syncBookCurrentPageFromSessions(bookId);
    
    // Verify the sync worked
    const updatedBook = await queryFirst<{current_page: number}>(
      'SELECT current_page FROM enhanced_books WHERE id = ?',
      [bookId]
    );
    console.log(`📚 Book current_page after sync: ${updatedBook?.current_page}`);
    
    // 7. Test backward compatibility - create session without pages_read
    console.log('🔄 Testing backward compatibility...');
    await execute(
      `INSERT INTO reading_sessions (book_id, minutes_read, date) 
       VALUES (?, ?, ?)`,
      [bookId, 20, today]
    );
    console.log('✅ Successfully created session without pages_read (backward compatible)');
    
    // 8. Verify all sessions were created
    const allSessions = await queryAll<{
      id: number;
      minutes_read: number;
      pages_read: number | null;
      notes: string | null;
    }>('SELECT id, minutes_read, pages_read, notes FROM reading_sessions WHERE book_id = ?', [bookId]);
    
    console.log('📊 All sessions for test book:');
    allSessions.forEach((session, index) => {
      console.log(`  Session ${index + 1}: ${session.minutes_read} min, ${session.pages_read || 'no'} pages, notes: ${session.notes || 'none'}`);
    });
    
    // 9. Clean up test data
    console.log('🧹 Cleaning up test data...');
    await execute('DELETE FROM reading_sessions WHERE book_id = ?', [bookId]);
    await execute('DELETE FROM enhanced_books WHERE id = ?', [bookId]);
    console.log('✅ Test data cleaned up');
    
    console.log('🎉 Migration test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDatabaseMigration()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}