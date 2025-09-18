import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { AppUsageTracking, EnhancedBook, NotificationPreferences, ReadingSession } from '../db/db';
import { execute, initializeDatabase, queryAll } from '../db/db';
import type { UserPreferences } from '../types/database';

// Current app schema version - increment when making breaking changes to backup format
const BACKUP_SCHEMA_VERSION = 1;
const APP_IDENTIFIER = 'pagestreak';

export type BackupData = {
  app: string;
  schemaVersion: number;
  createdAt: string;
  deviceInfo?: {
    platform: string;
    version: string;
  };
  tables: {
    enhanced_books?: EnhancedBook[];
    user_preferences?: UserPreferences[];
    reading_sessions?: ReadingSession[];
    weekly_progress?: WeeklyProgress[];
    notification_preferences?: NotificationPreferences[];
    app_usage_tracking?: AppUsageTracking[];
  };
};

export type WeeklyProgress = {
  id: number;
  weeks_passed: number;
  target_reading_minutes: number;
  achived_reading_minutes: number;
  date_created?: string;
};

export type BackupOptions = {
  includeBooks: boolean;
  includeReadingSessions: boolean;
  includeUserPreferences: boolean;
  includeWeeklyProgress: boolean;
  includeNotificationPreferences: boolean;
  includeAppUsage: boolean;
  compressed?: boolean; // For future use with .json.gz
};

export type ImportOptions = {
  mode: 'replace' | 'merge';
  validateIntegrity: boolean;
};

export type BackupValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalBooks: number;
    totalSessions: number;
    hasUserPreferences: boolean;
    schemaVersion: number;
    createdAt: string;
  };
};

/**
 * Let user select a directory to save the backup file
 */
export async function selectBackupSaveLocation(filename: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    // For iOS and Android, we'll use the sharing API to let user choose save location
    // Create a temporary file first
    const tempFilePath = FileSystem.documentDirectory + filename;
    
    return { success: true, filePath: tempFilePath };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to select save location' 
    };
  }
}

/**
 * Export and save backup file with user-selected location
 */
export async function exportAndSaveBackup(
  options: BackupOptions,
  onProgress?: (progress: number, message: string) => void
): Promise<{ success: boolean; filePath?: string; error?: string; userSaved?: boolean }> {
  try {
    // First create the backup data
    const exportResult = await exportDataToBackup(options, (progress, message) => {
      // Scale progress to 0-80% for the export phase
      onProgress?.(Math.floor(progress * 0.8), message);
    });

    if (!exportResult.success || !exportResult.filePath) {
      return exportResult;
    }

    onProgress?.(80, 'Preparing file for save...');

    // Now let user save it to their preferred location
    const saved = await shareBackupFile(exportResult.filePath);
    
    onProgress?.(100, saved ? 'File saved successfully!' : 'Backup created locally');

    return {
      ...exportResult,
      userSaved: saved
    };

  } catch (error) {
    console.error('Export and save failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Export user data to a JSON backup file
 */
export async function exportDataToBackup(
  options: BackupOptions,
  onProgress?: (progress: number, message: string) => void
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    onProgress?.(0, 'Starting backup...');

    const backupData: BackupData = {
      app: APP_IDENTIFIER,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      deviceInfo: {
        platform: 'mobile', // Could be enhanced with actual platform detection
        version: '1.0.0', // Could be read from package.json
      },
      tables: {},
    };

    let progress = 10;

    // Export enhanced_books
    if (options.includeBooks) {
      onProgress?.(progress, 'Exporting books...');
      const books = await queryAll<EnhancedBook>('SELECT * FROM enhanced_books ORDER BY id');
      backupData.tables.enhanced_books = books;
      progress += 15;
    }

    // Export reading_sessions
    if (options.includeReadingSessions) {
      onProgress?.(progress, 'Exporting reading sessions...');
      const sessions = await queryAll<ReadingSession>('SELECT * FROM reading_sessions ORDER BY created_at');
      backupData.tables.reading_sessions = sessions;
      progress += 15;
    }

    // Export user_preferences
    if (options.includeUserPreferences) {
      onProgress?.(progress, 'Exporting user preferences...');
      const preferences = await queryAll<UserPreferences>('SELECT * FROM user_preferences');
      backupData.tables.user_preferences = preferences;
      progress += 10;
    }

    // Export weekly_progress
    if (options.includeWeeklyProgress) {
      onProgress?.(progress, 'Exporting weekly progress...');
      const weeklyProgress = await queryAll<WeeklyProgress>('SELECT * FROM weekly_progress ORDER BY id');
      backupData.tables.weekly_progress = weeklyProgress;
      progress += 10;
    }

    // Export notification_preferences
    if (options.includeNotificationPreferences) {
      onProgress?.(progress, 'Exporting notification settings...');
      const notificationPrefs = await queryAll<NotificationPreferences>('SELECT * FROM notification_preferences');
      backupData.tables.notification_preferences = notificationPrefs;
      progress += 10;
    }

    // Export app_usage_tracking (optional, might be large)
    if (options.includeAppUsage) {
      onProgress?.(progress, 'Exporting app usage data...');
      const appUsage = await queryAll<AppUsageTracking>('SELECT * FROM app_usage_tracking ORDER BY date DESC');
      backupData.tables.app_usage_tracking = appUsage;
      progress += 10;
    }

    onProgress?.(80, 'Creating backup file...');

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `pagestreak-backup-${timestamp}.json`;
    
    // Always use default document directory for initial creation
    const filePath = FileSystem.documentDirectory + filename;

    // Write JSON data to file
    const jsonContent = JSON.stringify(backupData, null, 2);
    await FileSystem.writeAsStringAsync(filePath, jsonContent);

    onProgress?.(100, 'Backup complete!');

    return { success: true, filePath };
  } catch (error) {
    console.error('Export failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Share the backup file using the system share dialog
 */
export async function shareBackupFile(filePath: string): Promise<boolean> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(filePath, {
      dialogTitle: 'Save PageStreak Backup',
      mimeType: 'application/json',
    });

    return true;
  } catch (error) {
    console.error('Share failed:', error);
    return false;
  }
}

/**
 * Pick a backup file for import
 */
export async function pickBackupFile(): Promise<{ success: boolean; fileUri?: string; error?: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return { success: false, error: 'User cancelled file selection' };
    }

    return { success: true, fileUri: result.assets[0].uri };
  } catch (error) {
    console.error('File picker failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to pick file' 
    };
  }
}

/**
 * Validate a backup file before importing
 */
export async function validateBackupFile(fileUri: string): Promise<BackupValidationResult> {
  const result: BackupValidationResult = {
    isValid: false,
    errors: [],
    warnings: [],
    stats: {
      totalBooks: 0,
      totalSessions: 0,
      hasUserPreferences: false,
      schemaVersion: 0,
      createdAt: '',
    },
  };

  try {
    // Read and parse JSON
    const fileContent = await FileSystem.readAsStringAsync(fileUri);
    const backupData: BackupData = JSON.parse(fileContent);

    // Validate basic structure
    if (!backupData.app) {
      result.errors.push('Missing app identifier');
    } else if (backupData.app !== APP_IDENTIFIER) {
      result.errors.push(`Invalid app identifier: expected "${APP_IDENTIFIER}", got "${backupData.app}"`);
    }

    if (!backupData.schemaVersion) {
      result.errors.push('Missing schema version');
    } else {
      result.stats.schemaVersion = backupData.schemaVersion;
      if (backupData.schemaVersion > BACKUP_SCHEMA_VERSION) {
        result.errors.push(`Backup schema version ${backupData.schemaVersion} is newer than supported version ${BACKUP_SCHEMA_VERSION}`);
      } else if (backupData.schemaVersion < BACKUP_SCHEMA_VERSION) {
        result.warnings.push(`Backup schema version ${backupData.schemaVersion} is older than current version ${BACKUP_SCHEMA_VERSION}. Data will be migrated.`);
      }
    }

    if (!backupData.createdAt) {
      result.errors.push('Missing creation timestamp');
    } else {
      result.stats.createdAt = backupData.createdAt;
    }

    if (!backupData.tables) {
      result.errors.push('Missing tables data');
    } else {
      // Validate table data
      const { tables } = backupData;

      // Count statistics
      result.stats.totalBooks = tables.enhanced_books?.length || 0;
      result.stats.totalSessions = tables.reading_sessions?.length || 0;
      result.stats.hasUserPreferences = (tables.user_preferences?.length || 0) > 0;

      // Validate book data integrity
      if (tables.enhanced_books?.length) {
        const invalidBooks = tables.enhanced_books.filter(book => 
          !book.name || !book.author || typeof book.page !== 'number'
        );
        if (invalidBooks.length > 0) {
          result.errors.push(`${invalidBooks.length} books have invalid data`);
        }
      }

      // Validate reading sessions integrity
      if (tables.reading_sessions?.length) {
        const invalidSessions = tables.reading_sessions.filter(session => 
          !session.book_id || !session.minutes_read || !session.date
        );
        if (invalidSessions.length > 0) {
          result.errors.push(`${invalidSessions.length} reading sessions have invalid data`);
        }

        // Check for orphaned sessions (sessions without corresponding books)
        if (tables.enhanced_books?.length) {
          const bookIds = new Set(tables.enhanced_books.map(book => book.id));
          const orphanedSessions = tables.reading_sessions.filter(session => 
            !bookIds.has(session.book_id)
          );
          if (orphanedSessions.length > 0) {
            result.warnings.push(`${orphanedSessions.length} reading sessions reference books that don't exist in the backup`);
          }
        }
      }
    }

    result.isValid = result.errors.length === 0;

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Failed to parse backup file');
  }

  return result;
}

/**
 * Import data from a validated backup file
 */
export async function importDataFromBackup(
  fileUri: string,
  options: ImportOptions,
  onProgress?: (progress: number, message: string) => void
): Promise<{ success: boolean; error?: string; imported: { books: number; sessions: number; } }> {
  const importResult = {
    success: false,
    imported: { books: 0, sessions: 0 },
  };

  try {
    onProgress?.(0, 'Reading backup file...');

    // Read and validate backup
    const validationResult = await validateBackupFile(fileUri);
    if (!validationResult.isValid) {
      throw new Error(`Invalid backup file: ${validationResult.errors.join(', ')}`);
    }

    const fileContent = await FileSystem.readAsStringAsync(fileUri);
    const backupData: BackupData = JSON.parse(fileContent);

    onProgress?.(10, 'Starting import...');

    // Ensure database is properly initialized with latest schema
    await initializeDatabase();

    // Enable WAL mode for better performance
    await execute('PRAGMA journal_mode=WAL');
    await execute('PRAGMA foreign_keys=ON');

    // Start transaction
    await execute('BEGIN TRANSACTION');

    try {
      let progress = 20;

      // Import based on mode
      if (options.mode === 'replace') {
        onProgress?.(progress, 'Clearing existing data...');
        
        // Clear existing data in reverse dependency order
        if (backupData.tables.reading_sessions) {
          await execute('DELETE FROM reading_sessions');
        }
        if (backupData.tables.enhanced_books) {
          await execute('DELETE FROM enhanced_books');
        }
        if (backupData.tables.user_preferences) {
          await execute('DELETE FROM user_preferences');
        }
        if (backupData.tables.weekly_progress) {
          await execute('DELETE FROM weekly_progress');
        }
        if (backupData.tables.notification_preferences) {
          await execute('DELETE FROM notification_preferences');
        }
        if (backupData.tables.app_usage_tracking) {
          await execute('DELETE FROM app_usage_tracking');
        }
        
        progress += 10;
      }

      // Import user preferences first
      if (backupData.tables.user_preferences?.length) {
        onProgress?.(progress, 'Importing user preferences...');
        for (const pref of backupData.tables.user_preferences) {
          if (options.mode === 'replace') {
            await execute(`
              INSERT INTO user_preferences (
                id, username, yearly_book_goal, preferred_genres, created_at, updated_at,
                weekly_reading_goal, initial_reading_rate_minutes_per_day,
                end_reading_rate_goal_minutes_per_day, end_reading_rate_goal_date,
                current_reading_rate_minutes_per_day, current_reading_rate_last_updated,
                weekly_reading_rate_increase_minutes, weekly_reading_rate_increase_minutes_percentage
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              pref.id, pref.username, pref.yearly_book_goal, pref.preferred_genres,
              pref.created_at, pref.updated_at, pref.weekly_reading_goal,
              pref.initial_reading_rate_minutes_per_day, pref.end_reading_rate_goal_minutes_per_day,
              pref.end_reading_rate_goal_date, pref.current_reading_rate_minutes_per_day,
              pref.current_reading_rate_last_updated, pref.weekly_reading_rate_increase_minutes,
              pref.weekly_reading_rate_increase_minutes_percentage
            ]);
          } else {
            // Merge mode - use INSERT OR REPLACE
            await execute(`
              INSERT OR REPLACE INTO user_preferences (
                id, username, yearly_book_goal, preferred_genres, created_at, updated_at,
                weekly_reading_goal, initial_reading_rate_minutes_per_day,
                end_reading_rate_goal_minutes_per_day, end_reading_rate_goal_date,
                current_reading_rate_minutes_per_day, current_reading_rate_last_updated,
                weekly_reading_rate_increase_minutes, weekly_reading_rate_increase_minutes_percentage
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              pref.id, pref.username, pref.yearly_book_goal, pref.preferred_genres,
              pref.created_at, pref.updated_at, pref.weekly_reading_goal,
              pref.initial_reading_rate_minutes_per_day, pref.end_reading_rate_goal_minutes_per_day,
              pref.end_reading_rate_goal_date, pref.current_reading_rate_minutes_per_day,
              pref.current_reading_rate_last_updated, pref.weekly_reading_rate_increase_minutes,
              pref.weekly_reading_rate_increase_minutes_percentage
            ]);
          }
        }
        progress += 10;
      }

      // Import books
      if (backupData.tables.enhanced_books?.length) {
        onProgress?.(progress, 'Importing books...');
        for (const book of backupData.tables.enhanced_books) {
          if (options.mode === 'replace') {
            await execute(`
              INSERT INTO enhanced_books (
                id, name, author, page, isbn, cover_id, cover_url, first_publish_year,
                publisher, language, description, subjects, open_library_key, author_key,
                rating, date_added, date_started, date_finished, current_page, reading_status, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              book.id, book.name, book.author, book.page, book.isbn, book.cover_id,
              book.cover_url, book.first_publish_year, book.publisher, book.language,
              book.description, book.subjects, book.open_library_key, book.author_key,
              book.rating, book.date_added, book.date_started, book.date_finished,
              book.current_page, book.reading_status, book.notes
            ]);
          } else {
            // Merge mode - use INSERT OR REPLACE
            await execute(`
              INSERT OR REPLACE INTO enhanced_books (
                id, name, author, page, isbn, cover_id, cover_url, first_publish_year,
                publisher, language, description, subjects, open_library_key, author_key,
                rating, date_added, date_started, date_finished, current_page, reading_status, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              book.id, book.name, book.author, book.page, book.isbn, book.cover_id,
              book.cover_url, book.first_publish_year, book.publisher, book.language,
              book.description, book.subjects, book.open_library_key, book.author_key,
              book.rating, book.date_added, book.date_started, book.date_finished,
              book.current_page, book.reading_status, book.notes
            ]);
          }
        }
        importResult.imported.books = backupData.tables.enhanced_books.length;
        progress += 20;
      }

      // Import reading sessions
      if (backupData.tables.reading_sessions?.length) {
        onProgress?.(progress, 'Importing reading sessions...');
        for (const session of backupData.tables.reading_sessions) {
          if (options.mode === 'replace') {
            await execute(`
              INSERT INTO reading_sessions (id, book_id, minutes_read, pages_read, date, created_at, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              session.id, session.book_id, session.minutes_read, session.pages_read,
              session.date, session.created_at, session.notes
            ]);
          } else {
            // Merge mode - use INSERT OR REPLACE
            await execute(`
              INSERT OR REPLACE INTO reading_sessions (id, book_id, minutes_read, pages_read, date, created_at, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              session.id, session.book_id, session.minutes_read, session.pages_read,
              session.date, session.created_at, session.notes
            ]);
          }
        }
        importResult.imported.sessions = backupData.tables.reading_sessions.length;
        progress += 20;
      }

      // Import other tables...
      if (backupData.tables.weekly_progress?.length) {
        onProgress?.(progress, 'Importing weekly progress...');
        for (const weeklyProg of backupData.tables.weekly_progress) {
          const insertQuery = options.mode === 'replace' 
            ? 'INSERT INTO weekly_progress'
            : 'INSERT OR REPLACE INTO weekly_progress';
          
          await execute(`
            ${insertQuery} (id, weeks_passed, target_reading_minutes, achived_reading_minutes, date_created)
            VALUES (?, ?, ?, ?, ?)
          `, [
            weeklyProg.id, weeklyProg.weeks_passed, weeklyProg.target_reading_minutes,
            weeklyProg.achived_reading_minutes, weeklyProg.date_created
          ]);
        }
        progress += 10;
      }

      if (backupData.tables.notification_preferences?.length) {
        onProgress?.(progress, 'Importing notification preferences...');
        for (const notifPref of backupData.tables.notification_preferences) {
          const insertQuery = options.mode === 'replace' 
            ? 'INSERT INTO notification_preferences'
            : 'INSERT OR REPLACE INTO notification_preferences';
          
          await execute(`
            ${insertQuery} (
              id, notifications_enabled, daily_reminder_enabled, daily_reminder_hours_after_last_open,
              daily_reminder_title, daily_reminder_body, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            notifPref.id, notifPref.notifications_enabled, notifPref.daily_reminder_enabled,
            notifPref.daily_reminder_hours_after_last_open, notifPref.daily_reminder_title,
            notifPref.daily_reminder_body, notifPref.created_at, notifPref.updated_at
          ]);
        }
        progress += 5;
      }

      if (backupData.tables.app_usage_tracking?.length) {
        onProgress?.(progress, 'Importing app usage data...');
        for (const usage of backupData.tables.app_usage_tracking) {
          const insertQuery = options.mode === 'replace' 
            ? 'INSERT INTO app_usage_tracking'
            : 'INSERT OR REPLACE INTO app_usage_tracking';
          
          await execute(`
            ${insertQuery} (id, last_opened_at, last_closed_at, session_count_today, date)
            VALUES (?, ?, ?, ?, ?)
          `, [
            usage.id, usage.last_opened_at, usage.last_closed_at, usage.session_count_today, usage.date
          ]);
        }
      }

      // Commit transaction
      await execute('COMMIT');
      
      onProgress?.(100, 'Import completed successfully!');
      importResult.success = true;

    } catch (error) {
      // Rollback on error
      await execute('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Import failed:', error);
    return { 
      ...importResult,
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }

  return importResult;
}

/**
 * Get backup file information without importing
 */
export async function getBackupInfo(fileUri: string): Promise<{
  success: boolean;
  info?: {
    appName: string;
    schemaVersion: number;
    createdAt: string;
    totalBooks: number;
    totalSessions: number;
    hasUserPreferences: boolean;
    fileSize: string;
  };
  error?: string;
}> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    const validation = await validateBackupFile(fileUri);
    
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    const fileSize = fileInfo.exists && fileInfo.size 
      ? (fileInfo.size / 1024).toFixed(1) + ' KB'
      : 'Unknown';

    return {
      success: true,
      info: {
        appName: 'PageStreak',
        schemaVersion: validation.stats.schemaVersion,
        createdAt: validation.stats.createdAt,
        totalBooks: validation.stats.totalBooks,
        totalSessions: validation.stats.totalSessions,
        hasUserPreferences: validation.stats.hasUserPreferences,
        fileSize,
      }
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to read backup info' 
    };
  }
}