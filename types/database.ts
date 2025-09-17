export type UserPreferences = {
  id: number;
  username: string;
  yearly_book_goal: number;
  preferred_genres?: string;
  created_at?: string;
  updated_at?: string;
  weekly_reading_goal?: number;
  initial_reading_rate_minutes_per_day?: number;
  end_reading_rate_goal_minutes_per_day?: number;
  end_reading_rate_goal_date?: string;
  current_reading_rate_minutes_per_day?: number;
  current_reading_rate_last_updated?: string;
  weekly_reading_rate_increase_minutes?: number;
  weekly_reading_rate_increase_minutes_percentage?: number;
};

// Reading Session type for tracking reading progress
export type ReadingSession = {
  id: number;
  book_id: number;
  minutes_read: number;
  pages_read?: number; // Optional: pages read in this session
  date: string; // YYYY-MM-DD format
  created_at: string;
  notes?: string;
};

// Progress calculation result type
export type BookProgress = {
  pagesRead: number;
  percentage: number;
  isComplete: boolean;
  source: 'sessions' | 'current_page' | 'none';
};

export type Step = 1 | 2 | 3;
