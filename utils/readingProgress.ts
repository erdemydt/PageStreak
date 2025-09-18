import { execute, queryAll, queryFirst } from '../db/db';
import { dateToLocalDateString, getTodayDateString } from './dateUtils';

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
    
    if (totalPagesRead > 0) {
      await execute(
        'UPDATE enhanced_books SET current_page = ? WHERE id = ?',
        [totalPagesRead, bookId]
      );
    }
  } catch (error) {
    console.error('Error syncing book current page from sessions:', error);
  }
};

export const initializeReadingSessions = async () => {
  try {
    // Create reading_sessions table if it doesn't exist
    await execute(`
      CREATE TABLE IF NOT EXISTS reading_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        minutes_read INTEGER NOT NULL,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (book_id) REFERENCES enhanced_books (id)
      )
    `);

    console.log('Reading sessions table initialized successfully');
  } catch (error) {
    console.error('Error initializing reading sessions table:', error);
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

export const getReadingStreak = async (dailyGoal: number = 30): Promise<number> => {
  try {
    // Get all dates with reading sessions that meet the daily goal, ordered by date desc
    const result = await queryAll<{date: string, total_minutes: number}>(
      `SELECT date, SUM(minutes_read) as total_minutes 
       FROM reading_sessions 
       GROUP BY date 
       HAVING total_minutes >= ? 
       ORDER BY date DESC`,
      [dailyGoal]
    );

    if (result.length === 0) {
      return 0;
    }

    // Calculate consecutive days from today backwards
    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < result.length; i++) {
      const sessionDate = new Date(result[i].date);
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      
      // Check if this date matches our expected consecutive date
      if (sessionDate.toDateString() === expectedDate.toDateString()) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  } catch (error) {
    console.error('Error calculating reading streak:', error);
    return 0;
  }
};

export const getWeeklyReadingMinutes = async (): Promise<number[]> => {
  try {
    const today = new Date();
    const weekDates = [];
    
    // Get the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      weekDates.push(dateToLocalDateString(date));
    }
    
    const weeklyData = await Promise.all(
      weekDates.map(async (date) => {
        const result = await queryFirst<{total_minutes: number}>(
          'SELECT COALESCE(SUM(minutes_read), 0) as total_minutes FROM reading_sessions WHERE date = ?',
          [date]
        );
        return result?.total_minutes || 0;
      })
    );
    
    return weeklyData;
  } catch (error) {
    console.error('Error getting weekly reading data:', error);
    return [0, 0, 0, 0, 0, 0, 0];
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

export const getRecentReadingSessions = async (limit: number = 5) => {
  try {
    const sessions = await queryAll<{
      id: number;
      minutes_read: number;
      date: string;
      created_at: string;
      notes?: string;
      book_name: string;
      book_author: string;
    }>(
      `SELECT rs.*, eb.name as book_name, eb.author as book_author
       FROM reading_sessions rs
       JOIN enhanced_books eb ON rs.book_id = eb.id
       ORDER BY rs.created_at DESC
       LIMIT ?`,
      [limit]
    );
    return sessions;
  } catch (error) {
    console.error('Error getting recent reading sessions:', error);
    return [];
  }
};
