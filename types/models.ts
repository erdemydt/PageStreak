/**
 * Row types for the SQLite tables (see CLAUDE.md "Data model").
 * Import from here; db/db.tsx re-exports the older names for compatibility.
 */

export type ReadingStatus = "want_to_read" | "currently_reading" | "read";

// Enhanced Book type with Open Library API fields
export type EnhancedBook = {
  id: number;
  name: string;
  author: string;
  page: number;
  // Open Library API fields
  isbn?: string;
  cover_id?: number;
  cover_url?: string;
  first_publish_year?: number;
  publisher?: string;
  language?: string;
  description?: string;
  subjects?: string;
  open_library_key?: string;
  author_key?: string;
  rating?: number;
  date_added?: string;
  date_started?: string;
  date_finished?: string;
  current_page?: number;
  reading_status?: ReadingStatus;
  notes?: string;
};

// Reading Session type for tracking daily reading progress
export type ReadingSession = {
  id: number;
  book_id: number;
  minutes_read: number;
  pages_read?: number; // Optional: pages read in this session
  date: string; // YYYY-MM-DD format
  created_at: string;
  notes?: string;
};

// Daily reading progress summary
export type DailyProgress = {
  date: string;
  total_minutes: number;
  goal_minutes: number;
  percentage: number;
  sessions_count: number;
};

// Notification preferences type
export type NotificationPreferences = {
  id: number;
  notifications_enabled: boolean;
  daily_reminder_enabled: boolean;
  daily_reminder_hours_after_last_open: number;
  daily_reminder_title: string;
  daily_reminder_body: string;
  /** "after_close" (N hours after leaving the app) or "daily_time" (at reminder_time) */
  reminder_mode?: "after_close" | "daily_time";
  /** HH:MM, used when reminder_mode is "daily_time" */
  reminder_time?: string;
  created_at: string;
  updated_at: string;
};

// App usage tracking type
export type AppUsageTracking = {
  id: number;
  last_opened_at: string;
  last_closed_at?: string;
  session_count_today: number;
  date: string; // YYYY-MM-DD format
};

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

// Progress calculation result type
export type BookProgress = {
  pagesRead: number;
  percentage: number;
  isComplete: boolean;
  source: "sessions" | "current_page" | "none";
};
