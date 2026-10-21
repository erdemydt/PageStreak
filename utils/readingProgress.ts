import { execute, queryAll, queryFirst } from '../db/db';
import { addDaysToDateString, getTodayDateString } from './dateUtils';
import { GoalForDate, loadGoalForDate } from './goalHistory';

/**
 * Calculate book completion percentage based on cumulative pages read from sessions
 * This provides more accurate progress tracking than just current_page
 */
export const calculateBookProgressFromSessions = async (bookId: number, totalPages: number): Promise<{
  pagesRead: number;
  percentage: number;
  isComplete: boolean;
}> => {
  try {
    // Get total pages read from all sessions for this book
    const result = await queryFirst<{total_pages: number}>(
      'SELECT COALESCE(SUM(pages_read), 0) as total_pages FROM reading_sessions WHERE book_id = ? AND pages_read IS NOT NULL',
      [bookId]
    );
    
    const pagesRead = result?.total_pages || 0;
    const percentage = totalPages > 0 ? Math.min(Math.round((pagesRead / totalPages) * 100), 100) : 0;
    const isComplete = percentage >= 100;
    
    return {
      pagesRead,
      percentage,
      isComplete
    };
  } catch (error) {
    console.error('Error calculating book progress from sessions:', error);
    return { pagesRead: 0, percentage: 0, isComplete: false };
  }
};

/**
 * Pure version of getEnhancedBookProgress for books already loaded with their
 * session aggregate (see listBooksWithStats): session pages win, then current_page.
 */
export const computeBookProgress = (book: {
  page: number;
  current_page?: number | null;
  pages_from_sessions?: number | null;
}): { pagesRead: number; percentage: number; isComplete: boolean } => {
  const fromSessions = book.pages_from_sessions ?? 0;
  const pagesRead = fromSessions > 0 ? fromSessions : book.current_page ?? 0;
  const percentage =
    book.page > 0 ? Math.min(Math.round((pagesRead / book.page) * 100), 100) : 0;
  return { pagesRead, percentage, isComplete: percentage >= 100 };
};

/**
 * Get enhanced reading progress that combines both current_page and session-based tracking
 * Falls back to current_page if no page sessions are recorded
 */
export const getEnhancedBookProgress = async (bookId: number, totalPages: number, currentPage: number = 0): Promise<{
  pagesRead: number;
  percentage: number;
  isComplete: boolean;
  source: 'sessions' | 'current_page' | 'none';
}> => {
  try {
    // First try to get progress from sessions
    const sessionProgress = await calculateBookProgressFromSessions(bookId, totalPages);
    
    if (sessionProgress.pagesRead > 0) {
      return {
        ...sessionProgress,
        source: 'sessions'
      };
    }
    
    // Fall back to current_page if available
    if (currentPage > 0 && totalPages > 0) {
      const percentage = Math.min(Math.round((currentPage / totalPages) * 100), 100);
      return {
        pagesRead: currentPage,
        percentage,
        isComplete: percentage >= 100,
        source: 'current_page'
      };
    }
    
    // No progress data available
    return {
      pagesRead: 0,
      percentage: 0,
      isComplete: false,
      source: 'none'
    };
  } catch (error) {
    console.error('Error getting enhanced book progress:', error);
    return { pagesRead: 0, percentage: 0, isComplete: false, source: 'none' };
  }
};

/**
 * Update book's current_page based on cumulative pages from sessions
 * This keeps the current_page field in sync with session-based tracking
 */
export const syncBookCurrentPageFromSessions = async (bookId: number): Promise<void> => {
  try {
    const result = await queryFirst<{total_pages: number}>(
      'SELECT COALESCE(SUM(pages_read), 0) as total_pages FROM reading_sessions WHERE book_id = ? AND pages_read IS NOT NULL',
      [bookId]
    );
    
    const totalPagesRead = result?.total_pages || 0;

    // Always write, including 0, so that editing/deleting sessions can lower
    // the page count. Finished books stay pinned at their full page count.
    await execute(
      `UPDATE enhanced_books
       SET current_page = CASE
         WHEN reading_status = 'read' THEN page
         WHEN page > 0 THEN MIN(?, page)
         ELSE ?
       END
       WHERE id = ?`,
      [totalPagesRead, totalPagesRead, bookId]
    );
  } catch (error) {
    console.error('Error syncing book current page from sessions:', error);
  }
};

export const getTodayReadingMinutes = async (): Promise<number> => {
  try {
    const today = getTodayDateString();
    const result = await queryFirst<{total_minutes: number}>(
      'SELECT COALESCE(SUM(minutes_read), 0) as total_minutes FROM reading_sessions WHERE date = ?',
      [today]
    );
    return result?.total_minutes || 0;
  } catch (error) {
    console.error('Error getting today reading minutes:', error);
    return 0;
  }
};

/**
 * Computes the current and longest streak of consecutive days meeting the goal.
 * Each day is judged against the goal that applied on that day (goalForDate),
 * so a weekly goal increase never retroactively breaks a streak.
 * The current streak stays alive through today: if today's goal isn't met yet,
 * it counts back from yesterday instead of dropping to 0.
 */
export const calculateStreaks = (
  dailyTotals: { date: string; total_minutes: number }[],
  goalForDate: GoalForDate,
  today: string = getTodayDateString()
): { currentStreak: number; longestStreak: number } => {
  const goalMetDates = new Set(
    dailyTotals.filter(day => day.total_minutes >= goalForDate(day.date)).map(day => day.date)
  );

  let currentStreak = 0;
  let cursor = goalMetDates.has(today) ? today : addDaysToDateString(today, -1);
  while (goalMetDates.has(cursor)) {
    currentStreak++;
    cursor = addDaysToDateString(cursor, -1);
  }

  let longestStreak = 0;
  let runLength = 0;
  let previousDate: string | null = null;
  for (const date of [...goalMetDates].sort()) {
    runLength = previousDate && addDaysToDateString(previousDate, 1) === date ? runLength + 1 : 1;
    longestStreak = Math.max(longestStreak, runLength);
    previousDate = date;
  }

  return { currentStreak, longestStreak };
};

export const getReadingStreak = async (): Promise<number> => {
  try {
    const dailyTotals = await queryAll<{date: string, total_minutes: number}>(
      `SELECT date, SUM(minutes_read) as total_minutes
       FROM reading_sessions
       GROUP BY date`
    );

    return calculateStreaks(dailyTotals, await loadGoalForDate()).currentStreak;
  } catch (error) {
    console.error('Error calculating reading streak:', error);
    return 0;
  }
};

export const getBookReadingTime = async (bookId: number): Promise<number> => {
  try {
    const result = await queryFirst<{total_minutes: number}>(
      'SELECT COALESCE(SUM(minutes_read), 0) as total_minutes FROM reading_sessions WHERE book_id = ?',
      [bookId]
    );
    return result?.total_minutes || 0;
  } catch (error) {
    console.error('Error getting book reading time:', error);
    return 0;
  }
};
