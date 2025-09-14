/**
 * Test script for notification database operations
 * This script verifies that notification tables are properly created, updated, and deleted
 */

import { initializeDatabase, queryFirst, resetInitializationFlag } from '../db/db';
import NotificationService from '../services/notificationService';
import { logoutUser } from '../utils/migration';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string) {
  testResults.push({ name, passed, error });
  console.log(`${passed ? '✅' : '❌'} ${name}${error ? ` - ${error}` : ''}`);
}

async function runNotificationDatabaseTests(): Promise<void> {
  console.log('🔄 Starting notification database tests...\n');

  try {
    // Test 1: Database initialization creates notification tables
    await testDatabaseInitialization();

    // Test 2: Default notification preferences are created
    await testDefaultNotificationPreferences();

    // Test 3: Notification preferences can be updated
    await testNotificationPreferencesUpdate();

    // Test 4: App usage tracking works
    await testAppUsageTracking();

    // Test 5: Notification service reset works
    await testNotificationServiceReset();

    // Test 6: Logout properly cleans up notification data
    await testLogoutCleanup();

    // Test 7: Re-initialization after logout works
    await testReInitializationAfterLogout();

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }

  // Print summary
  console.log('\n📊 Test Results Summary:');
  const passed = testResults.filter(r => r.passed).length;
  const total = testResults.length;
  console.log(`${passed}/${total} tests passed`);
  
  if (passed !== total) {
    console.log('\nFailed tests:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
  }
}

async function testDatabaseInitialization(): Promise<void> {
  try {
    // Reset and initialize database
    resetInitializationFlag();
    await initializeDatabase();

    // Check if notification_preferences table exists
    const notifTable = await queryFirst(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='notification_preferences'"
    );
    
    // Check if app_usage_tracking table exists
    const usageTable = await queryFirst(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_usage_tracking'"
    );

    logTest(
      'Database initialization creates notification tables',
      !!(notifTable && usageTable),
      !notifTable ? 'notification_preferences table not created' : 
      !usageTable ? 'app_usage_tracking table not created' : undefined
    );
  } catch (error) {
    logTest('Database initialization creates notification tables', false, error?.toString());
  }
}

async function testDefaultNotificationPreferences(): Promise<void> {
  try {
    const prefs = await NotificationService.getNotificationPreferences();
    
    logTest(
      'Default notification preferences are created',
      !!(prefs && prefs.id === 1 && prefs.notifications_enabled && prefs.daily_reminder_enabled),
      !prefs ? 'No preferences found' : 
      prefs.id !== 1 ? 'Invalid preference ID' :
      !prefs.notifications_enabled ? 'Notifications not enabled by default' :
      !prefs.daily_reminder_enabled ? 'Daily reminders not enabled by default' : undefined
    );
  } catch (error) {
    logTest('Default notification preferences are created', false, error?.toString());
  }
}

async function testNotificationPreferencesUpdate(): Promise<void> {
  try {
    // Update preferences
    const success = await NotificationService.updateNotificationPreferences({
      daily_reminder_hours_after_last_open: 8,
      daily_reminder_title: 'Test Title'
    });

    // Verify update
    const updatedPrefs = await NotificationService.getNotificationPreferences();
    
    logTest(
      'Notification preferences can be updated',
      success && updatedPrefs?.daily_reminder_hours_after_last_open === 8 && updatedPrefs?.daily_reminder_title === 'Test Title',
      !success ? 'Update operation failed' :
      updatedPrefs?.daily_reminder_hours_after_last_open !== 8 ? 'Hours not updated correctly' :
      updatedPrefs?.daily_reminder_title !== 'Test Title' ? 'Title not updated correctly' : undefined
    );
  } catch (error) {
    logTest('Notification preferences can be updated', false, error?.toString());
  }
}

async function testAppUsageTracking(): Promise<void> {
  try {
    // Simulate app state changes
    await NotificationService.onAppStateChange('active');
    await NotificationService.onAppStateChange('background');

    // Check if usage was tracked
    const usage = await queryFirst('SELECT * FROM app_usage_tracking ORDER BY id DESC LIMIT 1');
    
    logTest(
      'App usage tracking works',
      !!(usage && usage.last_opened_at),
      !usage ? 'No usage tracking record found' :
      !usage.last_opened_at ? 'Last opened time not recorded' : undefined
    );
  } catch (error) {
    logTest('App usage tracking works', false, error?.toString());
  }
}

async function testNotificationServiceReset(): Promise<void> {
  try {
    await NotificationService.reset();
    
    // Verify preferences still exist after reset
    const prefs = await NotificationService.getNotificationPreferences();
    
    logTest(
      'Notification service reset works',
      !!(prefs && prefs.id === 1),
      !prefs ? 'Preferences not found after reset' :
      prefs.id !== 1 ? 'Invalid preference ID after reset' : undefined
    );
  } catch (error) {
    logTest('Notification service reset works', false, error?.toString());
  }
}

async function testLogoutCleanup(): Promise<void> {
  try {
    // Perform logout
    await logoutUser();

    // Check if notification tables were dropped
    const notifTable = await queryFirst(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='notification_preferences'"
    );
    const usageTable = await queryFirst(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_usage_tracking'"
    );

    logTest(
      'Logout properly cleans up notification data',
      !(notifTable && usageTable), // Should be null/false after logout
      (notifTable || usageTable) ? 'Tables not properly dropped during logout' : undefined
    );
  } catch (error) {
    logTest('Logout properly cleans up notification data', false, error?.toString());
  }
}

async function testReInitializationAfterLogout(): Promise<void> {
  try {
    // Re-initialize after logout
    resetInitializationFlag();
    await initializeDatabase();

    // Check if tables were recreated
    const notifTable = await queryFirst(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='notification_preferences'"
    );
    const usageTable = await queryFirst(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_usage_tracking'"
    );

    // Check if default preferences are created
    const prefs = await NotificationService.getNotificationPreferences();

    logTest(
      'Re-initialization after logout works',
      !!(notifTable && usageTable && prefs && prefs.id === 1),
      !notifTable ? 'notification_preferences table not recreated' :
      !usageTable ? 'app_usage_tracking table not recreated' :
      !prefs ? 'Default preferences not created' :
      prefs.id !== 1 ? 'Invalid preference ID' : undefined
    );
  } catch (error) {
    logTest('Re-initialization after logout works', false, error?.toString());
  }
}

// Export for use in other test files
export { runNotificationDatabaseTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runNotificationDatabaseTests()
    .then(() => {
      console.log('\n🎉 Notification database tests completed!');
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}
