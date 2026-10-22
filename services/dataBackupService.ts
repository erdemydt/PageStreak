import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { AppUsageTracking, EnhancedBook, NotificationPreferences, ReadingSession } from '../db/db';
import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';
import db, { initializeDatabase, queryAll } from '../db/db';
import type { UserPreferences } from '../types/models';
import i18n from '../i18n';
import { emitDataChange } from '../utils/dataEvents';
import { backfillGoalHistoryIfEmpty } from '../utils/goalHistory';
import { clearReadingTimer } from '../utils/readingTimer';
import { syncBookCurrentPageFromSessions } from '../utils/readingProgress';

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
    // Added after schema v1; absent in older backups
    goal_history?: { effective_date: string; minutes: number }[];
  };
};

export type WeeklyProgress = {
  id: number;
  weeks_passed: number;
  target_reading_minutes: number;
  achived_reading_minutes: number;
  date_created?: string;
};

export type ImportMode = 'replace' | 'merge';

/** What a backup file holds, for the restore sheet */
export type BackupPreview = {
  fileUri: string;
  createdAt: string;
  books: number;
  sessions: number;
  /** Name, goals and reminder settings */
  hasProfile: boolean;
};

/**
 * Why a file can't be restored, for a localized message:
 * not JSON or not ours, made by a newer app version, or ours but damaged
 */
export type BackupProblem = 'notBackup' | 'newerVersion' | 'damaged';

export type BackupValidationResult = {
  isValid: boolean;
  problem?: BackupProblem;
  /** Developer detail for logs; not shown to users */
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
 * Write a backup of everything (books, sessions, profile and goals, reminder
 * settings, app usage) and open the share sheet so the user can save it.
 * There is deliberately no way to leave tables out: a partial backup (e.g.
 * sessions without their books) can't be restored.
 */
export async function exportAndSaveBackup(): Promise<{ success: boolean; error?: string }> {
  try {
    const backupData: BackupData = {
      app: APP_IDENTIFIER,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      deviceInfo: {
        platform: Platform.OS,
        version: Application.nativeApplicationVersion ?? 'unknown',
      },
      tables: {
        enhanced_books: await queryAll<EnhancedBook>('SELECT * FROM enhanced_books ORDER BY id'),
        reading_sessions: await queryAll<ReadingSession>('SELECT * FROM reading_sessions ORDER BY created_at'),
        user_preferences: await queryAll<UserPreferences>('SELECT * FROM user_preferences'),
        goal_history: await queryAll<{ effective_date: string; minutes: number }>(
          'SELECT effective_date, minutes FROM goal_history ORDER BY effective_date'
        ),
        // Vestigial, kept so older app versions can still read the file
        weekly_progress: await queryAll<WeeklyProgress>('SELECT * FROM weekly_progress ORDER BY id'),
        notification_preferences: await queryAll<NotificationPreferences>('SELECT * FROM notification_preferences'),
        app_usage_tracking: await queryAll<AppUsageTracking>('SELECT * FROM app_usage_tracking ORDER BY date DESC'),
      },
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    // The cache: the share sheet copies it wherever the user saves it, so nothing piles up here
    const filePath = `${FileSystem.cacheDirectory}pagestreak-backup-${timestamp}.json`;
    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backupData, null, 2));

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing is not available on this device');
    }
    // Resolves when the share sheet closes, saved or not (iOS doesn't say)
    await Sharing.shareAsync(filePath, {
      dialogTitle: i18n.t('dataBackup.export.shareTitle'),
      mimeType: 'application/json',
      UTI: 'public.json',
    });
    return { success: true };
  } catch (error) {
    console.error('Export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/** Let the user pick a backup file; null if they cancel */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  return result.canceled ? null : result.assets[0].uri;
}

/** Read and check a picked file: what it holds, or why it can't be restored */
export async function previewBackup(
  fileUri: string
): Promise<{ preview: BackupPreview } | { problem: BackupProblem }> {
  const validation = await validateBackupFile(fileUri);
  if (!validation.isValid) {
    console.warn('Backup rejected:', validation.errors.join('; '));
    return { problem: validation.problem ?? 'damaged' };
  }
  return {
    preview: {
      fileUri,
      createdAt: validation.stats.createdAt,
      books: validation.stats.totalBooks,
      sessions: validation.stats.totalSessions,
      hasProfile: validation.stats.hasUserPreferences,
    },
  };
}

/** Whether this device has anything a restore could merge with or overwrite */
export async function hasLocalData(): Promise<boolean> {
  const row = await queryAll<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM enhanced_books)
          + (SELECT COUNT(*) FROM reading_sessions)
          + (SELECT COUNT(*) FROM user_preferences) AS n`
  );
  return (row[0]?.n ?? 0) > 0;
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
  const fail = (problem: BackupProblem, detail: string) => {
    result.problem ??= problem;
    result.errors.push(detail);
  };

  try {
    // Read and parse JSON
    const fileContent = await FileSystem.readAsStringAsync(fileUri);
    const backupData: BackupData = JSON.parse(fileContent);

    // Validate basic structure
    if (!backupData || typeof backupData !== 'object' || !backupData.app) {
      fail('notBackup', 'Missing app identifier');
    } else if (backupData.app !== APP_IDENTIFIER) {
      fail('notBackup', `Invalid app identifier: expected "${APP_IDENTIFIER}", got "${backupData.app}"`);
    }

    if (!backupData?.schemaVersion) {
      fail('notBackup', 'Missing schema version');
    } else {
      result.stats.schemaVersion = backupData.schemaVersion;
      if (backupData.schemaVersion > BACKUP_SCHEMA_VERSION) {
        fail('newerVersion', `Backup schema version ${backupData.schemaVersion} is newer than supported version ${BACKUP_SCHEMA_VERSION}`);
      }
    }

    if (!backupData?.createdAt) {
      fail('damaged', 'Missing creation timestamp');
    } else {
      result.stats.createdAt = backupData.createdAt;
    }

    if (!backupData?.tables) {
      fail('damaged', 'Missing tables data');
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
          fail('damaged', `${invalidBooks.length} books have invalid data`);
        }
      }

      // Validate reading sessions integrity
      if (tables.reading_sessions?.length) {
        const invalidSessions = tables.reading_sessions.filter(session =>
          !session.book_id || !session.minutes_read || !session.date
        );
        if (invalidSessions.length > 0) {
          fail('damaged', `${invalidSessions.length} reading sessions have invalid data`);
        }

        // Check for orphaned sessions (sessions without corresponding books)
        const bookIds = new Set((tables.enhanced_books ?? []).map(book => book.id));
        const orphanedSessions = tables.reading_sessions.filter(session =>
          !bookIds.has(session.book_id)
        );
        if (orphanedSessions.length > 0) {
          result.warnings.push(`${orphanedSessions.length} reading sessions reference books that don't exist in the backup`);
        }
      }
    }

    result.isValid = result.errors.length === 0;

  } catch (error) {
    fail('notBackup', error instanceof Error ? error.message : 'Failed to parse backup file');
  }

  return result;
}

/**
 * Run a statement on a specific connection (e.g. a transaction), binding
 * missing backup fields (undefined) as NULL
 */
function runIn(conn: Pick<SQLiteDatabase, 'runAsync'>, sql: string, params: unknown[] = []) {
  return conn.runAsync(sql, params.map(value => value ?? null) as SQLiteBindValue[]);
}

/**
 * Find a local book that is the same book as a backup entry: same Open Library
 * key when available, otherwise same title and author (case-insensitive)
 */
async function findMatchingBook(
  conn: Pick<SQLiteDatabase, 'getFirstAsync'>,
  book: EnhancedBook
): Promise<{ id: number } | null> {
  if (book.open_library_key) {
    const byKey = await conn.getFirstAsync<{ id: number }>(
      'SELECT id FROM enhanced_books WHERE open_library_key = ?',
      [book.open_library_key]
    );
    if (byKey) return byKey;
  }
  return conn.getFirstAsync<{ id: number }>(
    'SELECT id FROM enhanced_books WHERE LOWER(name) = LOWER(?) AND LOWER(author) = LOWER(?)',
    [book.name, book.author]
  );
}

/**
 * Restore a backup file.
 * - replace: everything here is deleted and the backup takes its place.
 * - merge: the backup's books and sessions are added (matching books and duplicate
 *   sessions are skipped). The profile, goals, goal history and reminder settings
 *   come from the backup only when this device has no profile yet; otherwise
 *   nothing already here is overwritten.
 */
export async function importDataFromBackup(
  fileUri: string,
  mode: ImportMode
): Promise<{ success: boolean; error?: string; imported: { books: number; sessions: number; } }> {
  const importResult = {
    success: false,
    imported: { books: 0, sessions: 0 },
  };

  try {
    // Read and validate backup
    const validationResult = await validateBackupFile(fileUri);
    if (!validationResult.isValid) {
      throw new Error(`Invalid backup file: ${validationResult.errors.join(', ')}`);
    }

    const fileContent = await FileSystem.readAsStringAsync(fileUri);
    const backupData: BackupData = JSON.parse(fileContent);

    // Ensure database is properly initialized with latest schema
    await initializeDatabase();

    // Merge mode bookkeeping: backup book id -> local book id
    const bookIdMap = new Map<number, number>();
    const touchedBookIds = new Set<number>();
    let importedBooks = 0;
    let importedSessions = 0;
    // Replace mode clears preferences whenever the backup has the key (even
    // empty), so the goal timeline must be reset in exactly those cases too.
    // Merge decides inside the transaction (only onto a device without a profile).
    let importsPreferences =
      mode === 'replace' && !!backupData.tables.user_preferences;

    // One exclusive transaction on its own connection: other writes (e.g. app
    // usage tracking on app-state changes) can't slip into it, and any error
    // rolls the whole import back. Every statement must go through `txn`.
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Merge never overwrites settings: the profile, goals and reminder settings
      // come from the backup only when this device has no profile of its own
      const takeSettings =
        mode === 'replace' ||
        !(await txn.getFirstAsync('SELECT id FROM user_preferences LIMIT 1'));
      if (mode === 'merge') {
        importsPreferences = takeSettings && !!backupData.tables.user_preferences?.length;
      }

      // Import based on mode
      if (mode === 'replace') {
        
        // Clear existing data in reverse dependency order
        if (backupData.tables.reading_sessions) {
          await runIn(txn, 'DELETE FROM reading_sessions');
        }
        if (backupData.tables.enhanced_books) {
          await runIn(txn, 'DELETE FROM enhanced_books');
        }
        if (backupData.tables.user_preferences) {
          await runIn(txn, 'DELETE FROM user_preferences');
        }
        if (backupData.tables.weekly_progress) {
          await runIn(txn, 'DELETE FROM weekly_progress');
        }
        if (backupData.tables.notification_preferences) {
          await runIn(txn, 'DELETE FROM notification_preferences');
        }
        if (backupData.tables.app_usage_tracking) {
          await runIn(txn, 'DELETE FROM app_usage_tracking');
        }
      }

      // Import user preferences first
      if (takeSettings && backupData.tables.user_preferences?.length) {
        for (const pref of backupData.tables.user_preferences) {
          // Replace cleared the table; merge only gets here with no local profile
          await runIn(txn, `
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

      // Import books
      if (backupData.tables.enhanced_books?.length) {
        for (const book of backupData.tables.enhanced_books) {
          if (mode === 'replace') {
            await runIn(txn, `
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
            // Merge mode: never overwrite by id (ids are per-device, so the
            // same id is usually a different book). Reuse a matching existing
            // book, otherwise insert with a fresh id, and remember the mapping.
            const existing = await findMatchingBook(txn, book);
            if (existing) {
              bookIdMap.set(book.id, existing.id);
              continue;
            }

            const insertResult = await runIn(txn, `
              INSERT INTO enhanced_books (
                name, author, page, isbn, cover_id, cover_url, first_publish_year,
                publisher, language, description, subjects, open_library_key, author_key,
                rating, date_added, date_started, date_finished, current_page, reading_status, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              book.name, book.author, book.page, book.isbn, book.cover_id,
              book.cover_url, book.first_publish_year, book.publisher, book.language,
              book.description, book.subjects, book.open_library_key, book.author_key,
              book.rating, book.date_added, book.date_started, book.date_finished,
              book.current_page, book.reading_status, book.notes
            ]);
            bookIdMap.set(book.id, insertResult.lastInsertRowId);
            importedBooks++;
          }
        }
        importResult.imported.books =
          mode === 'replace' ? backupData.tables.enhanced_books.length : importedBooks;
      }

      // Import reading sessions
      if (backupData.tables.reading_sessions?.length) {
        for (const session of backupData.tables.reading_sessions) {
          if (mode === 'replace') {
            await runIn(txn, `
              INSERT INTO reading_sessions (id, book_id, minutes_read, pages_read, date, created_at, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              session.id, session.book_id, session.minutes_read, session.pages_read,
              session.date, session.created_at, session.notes
            ]);
          } else {
            // Merge mode: point the session at the merged book id; skip sessions
            // whose book wasn't imported and sessions that already exist
            const bookId = bookIdMap.get(session.book_id);
            if (bookId === undefined) {
              continue;
            }

            const duplicate = await txn.getFirstAsync(
              `SELECT id FROM reading_sessions
               WHERE book_id = ? AND date = ? AND minutes_read = ? AND created_at IS ?`,
              [bookId, session.date, session.minutes_read, session.created_at ?? null]
            );
            if (duplicate) {
              continue;
            }

            await runIn(txn, `
              INSERT INTO reading_sessions (book_id, minutes_read, pages_read, date, created_at, notes)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              bookId, session.minutes_read, session.pages_read,
              session.date, session.created_at, session.notes
            ]);
            importedSessions++;
            touchedBookIds.add(bookId);
          }
        }
        importResult.imported.sessions =
          mode === 'replace' ? backupData.tables.reading_sessions.length : importedSessions;
      }

      // weekly_progress and app_usage_tracking are device-local bookkeeping keyed
      // by id; merging them by id would overwrite unrelated local rows, so they
      // are only restored in replace mode.
      if (mode === 'replace' && backupData.tables.weekly_progress?.length) {
        for (const weeklyProg of backupData.tables.weekly_progress) {
          const insertQuery = mode === 'replace' 
            ? 'INSERT INTO weekly_progress'
            : 'INSERT OR REPLACE INTO weekly_progress';
          
          await runIn(txn, `
            ${insertQuery} (id, weeks_passed, target_reading_minutes, achived_reading_minutes, date_created)
            VALUES (?, ?, ?, ?, ?)
          `, [
            weeklyProg.id, weeklyProg.weeks_passed, weeklyProg.target_reading_minutes,
            weeklyProg.achived_reading_minutes, weeklyProg.date_created
          ]);
        }
      }

      if (takeSettings && backupData.tables.notification_preferences?.length) {
        for (const notifPref of backupData.tables.notification_preferences) {
          const insertQuery = mode === 'replace' 
            ? 'INSERT INTO notification_preferences'
            : 'INSERT OR REPLACE INTO notification_preferences';
          
          await runIn(txn, `
            ${insertQuery} (
              id, notifications_enabled, daily_reminder_enabled, daily_reminder_hours_after_last_open,
              daily_reminder_title, daily_reminder_body, created_at, updated_at,
              reminder_mode, reminder_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            notifPref.id, notifPref.notifications_enabled, notifPref.daily_reminder_enabled,
            notifPref.daily_reminder_hours_after_last_open, notifPref.daily_reminder_title,
            notifPref.daily_reminder_body, notifPref.created_at, notifPref.updated_at,
            // Older backups lack these columns
            notifPref.reminder_mode ?? 'after_close', notifPref.reminder_time ?? '20:00'
          ]);
        }
      }

      if (mode === 'replace' && backupData.tables.app_usage_tracking?.length) {
        for (const usage of backupData.tables.app_usage_tracking) {
          const insertQuery = mode === 'replace' 
            ? 'INSERT INTO app_usage_tracking'
            : 'INSERT OR REPLACE INTO app_usage_tracking';
          
          await runIn(txn, `
            ${insertQuery} (id, last_opened_at, last_closed_at, session_count_today, date)
            VALUES (?, ?, ?, ?, ?)
          `, [
            usage.id, usage.last_opened_at, usage.last_closed_at, usage.session_count_today, usage.date
          ]);
        }
      }


      // The goal timeline belongs to the imported preferences
      if (importsPreferences) {
        await runIn(txn, 'DELETE FROM goal_history');
        for (const row of backupData.tables.goal_history ?? []) {
          await runIn(txn, 
            'INSERT OR REPLACE INTO goal_history (effective_date, minutes) VALUES (?, ?)',
            [row.effective_date, row.minutes]
          );
        }
      }
    });

    // Committed from here on: a failed follow-up step must not report the import as failed
    importResult.success = true;
    try {
      // Keep merged books' current_page consistent with their combined sessions
      for (const bookId of touchedBookIds) {
        await syncBookCurrentPageFromSessions(bookId);
      }
      // Older backups carry no goal history: rebuild it from the imported plan
      if (importsPreferences) {
        await backfillGoalHistoryIfEmpty();
      }
      // Replace mode swaps all books; a running timer could point at an unrelated one
      if (mode === 'replace') {
        await clearReadingTimer();
      }
    } catch (error) {
      console.error('Post-import cleanup failed:', error);
    }
    emitDataChange('books', 'sessions', 'preferences');

  } catch (error) {
    console.error('Import failed:', error);
    return { 
      ...importResult,
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }

  return importResult;
}
