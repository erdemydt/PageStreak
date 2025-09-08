import { execute, queryAll, queryFirst } from '../db/db';

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
    const today = new Date().toISOString().split('T')[0];
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
      weekDates.push(date.toISOString().split('T')[0]);
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
