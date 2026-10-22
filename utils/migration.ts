import { execute, runInTransaction } from '../db/db';
import NotificationService from '../services/notificationService';
import { emitDataChange } from './dataEvents';
import { log, warn } from './logger';
import { clearReadingTimer } from './readingTimer';

/**
 * Every table holding user data. The schema itself (and its version) is kept:
 * erasing only deletes rows, so no table needs re-creating afterwards.
 */
const USER_DATA_TABLES = [
  'reading_sessions',
  'enhanced_books',
  'goal_history',
  'user_preferences',
  'weekly_progress',
  'notification_preferences',
  'app_usage_tracking',
];

/**
 * "Erase all data" (Settings): removes every book, session and setting.
 * WARNING: irreversible.
 */
export const logoutUser = async () => {
  log('👋 Erasing all user data');

  // Cancel any scheduled notifications before clearing data
  try {
    await NotificationService.cleanup();
  } catch (notifError) {
    warn('⚠️  Could not cancel notifications:', notifError);
  }

  try {
    await runInTransaction(async () => {
      for (const table of USER_DATA_TABLES) {
        await execute(`DELETE FROM ${table}`);
      }
      // Very old installs may still have the legacy table (migrated into
      // enhanced_books by the baseline migration); erase means erase
      await execute('DROP TABLE IF EXISTS books');
      // Unused since migrations moved to PRAGMA user_version
      await execute('DROP TABLE IF EXISTS database_version');
      // Restart AUTOINCREMENT ids like a fresh install
      await execute('DELETE FROM sqlite_sequence');
    });
    // The Home timer lives in AsyncStorage and may reference an erased book
    await clearReadingTimer().catch(() => {});
    emitDataChange('books', 'sessions', 'preferences');
    log('🎉 All user data erased');
    return true;
  } catch (error) {
    console.error('❌ Erase failed:', error);
    throw error;
  }
};
