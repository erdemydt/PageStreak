/**
 * Test script to verify database initialization works correctly
 * This can be used during development to ensure all tables are created properly
 */

import { initializeDatabase, queryAll, resetInitializationFlag } from '../db/db';

export async function testDatabaseInitialization() {
  try {
    console.log('🧪 Testing database initialization...');
    
    // Reset initialization flag to force re-initialization for testing
    resetInitializationFlag();
    
    // Initialize the database
    await initializeDatabase();
    
    // Verify all required tables exist
    const tables = await queryAll(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    
    const tableNames = tables.map((table: any) => table.name);
    const requiredTables = [
      'enhanced_books',
      'user_preferences', 
      'reading_sessions',
      'weekly_progress'
    ];
    
    console.log('📋 Found tables:', tableNames);
    
    const missingTables = requiredTables.filter(table => !tableNames.includes(table));
    
    if (missingTables.length === 0) {
      console.log('✅ All required tables created successfully!');
      
      // Test table schemas
      await testTableSchemas();
      
      // Test inserting some sample data
      await testSampleData();
      
      return true;
    } else {
      console.error('❌ Missing required tables:', missingTables);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Database initialization test failed:', error);
    return false;
  }
}

async function testTableSchemas() {
  console.log('🔍 Testing table schemas...');
  
  // Test enhanced_books schema
  const booksColumns = await queryAll(`PRAGMA table_info(enhanced_books)`);
  const expectedBookColumns = [
    'id', 'name', 'author', 'page', 'isbn', 'cover_id', 'cover_url',
    'first_publish_year', 'publisher', 'language', 'description', 'subjects',
    'open_library_key', 'author_key', 'rating', 'date_added', 'date_started',
    'date_finished', 'current_page', 'reading_status', 'notes'
  ];
  
  const bookColumnNames = booksColumns.map((col: any) => col.name);
  const missingBookColumns = expectedBookColumns.filter(col => !bookColumnNames.includes(col));
  
  if (missingBookColumns.length === 0) {
    console.log('✅ enhanced_books table has all required columns');
  } else {
    console.error('❌ enhanced_books missing columns:', missingBookColumns);
  }
  
  // Test user_preferences schema
  const userColumns = await queryAll(`PRAGMA table_info(user_preferences)`);
  const expectedUserColumns = [
    'id', 'username', 'yearly_book_goal', 'preferred_genres', 'created_at',
    'updated_at', 'weekly_reading_goal', 'initial_reading_rate_minutes_per_day',
    'end_reading_rate_goal_minutes_per_day', 'end_reading_rate_goal_date',
    'current_reading_rate_minutes_per_day', 'current_reading_rate_last_updated',
    'weekly_reading_rate_increase_minutes', 'weekly_reading_rate_increase_minutes_percentage'
  ];
  
  const userColumnNames = userColumns.map((col: any) => col.name);
  const missingUserColumns = expectedUserColumns.filter(col => !userColumnNames.includes(col));
  
  if (missingUserColumns.length === 0) {
    console.log('✅ user_preferences table has all required columns');
  } else {
    console.error('❌ user_preferences missing columns:', missingUserColumns);
  }
  
  // Test reading_sessions schema
  const sessionsColumns = await queryAll(`PRAGMA table_info(reading_sessions)`);
  const expectedSessionColumns = ['id', 'book_id', 'minutes_read', 'date', 'created_at', 'notes'];
  
  const sessionColumnNames = sessionsColumns.map((col: any) => col.name);
  const missingSessionColumns = expectedSessionColumns.filter(col => !sessionColumnNames.includes(col));
  
  if (missingSessionColumns.length === 0) {
    console.log('✅ reading_sessions table has all required columns');
  } else {
    console.error('❌ reading_sessions missing columns:', missingSessionColumns);
  }
  
  // Test weekly_progress schema
  const progressColumns = await queryAll(`PRAGMA table_info(weekly_progress)`);
  const expectedProgressColumns = ['id', 'weeks_passed', 'target_reading_minutes', 'achived_reading_minutes', 'date_created'];
  
  const progressColumnNames = progressColumns.map((col: any) => col.name);
  const missingProgressColumns = expectedProgressColumns.filter(col => !progressColumnNames.includes(col));
  
  if (missingProgressColumns.length === 0) {
    console.log('✅ weekly_progress table has all required columns');
  } else {
    console.error('❌ weekly_progress missing columns:', missingProgressColumns);
  }
}

async function testSampleData() {
  try {
    // Check if we can query each table (they should be empty but queryable)
    const bookCount = await queryAll('SELECT COUNT(*) as count FROM enhanced_books');
    const userCount = await queryAll('SELECT COUNT(*) as count FROM user_preferences');
    const sessionCount = await queryAll('SELECT COUNT(*) as count FROM reading_sessions');
    const progressCount = await queryAll('SELECT COUNT(*) as count FROM weekly_progress');
    
    console.log('📊 Table counts:');
    console.log('  - enhanced_books:', bookCount[0]?.count || 0);
    console.log('  - user_preferences:', userCount[0]?.count || 0);
    console.log('  - reading_sessions:', sessionCount[0]?.count || 0);
    console.log('  - weekly_progress:', progressCount[0]?.count || 0);
    
    console.log('✅ All tables are queryable!');
    
  } catch (error) {
    console.error('❌ Failed to query tables:', error);
    throw error;
  }
}

// Export for use in other files
export default testDatabaseInitialization;
