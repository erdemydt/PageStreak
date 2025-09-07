export type UserPreferences = {
  id: number;
  username: string;
  yearly_book_goal: number;
  preferred_genres?: string;
  created_at?: string;
  updated_at?: string;
  weekly_reading_goal?: number;
  daily_reading_goal?: number;
  initial_reading_rate_minutes_per_day?: number;
  end_reading_rate_goal_minutes_per_day?: number;
  end_reading_rate_goal_date?: string;
  current_reading_rate_minutes_per_day?: number;
  current_reading_rate_last_updated?: string;
  weekly_reading_rate_increase_minutes?: number;
  weekly_reading_rate_increase_minutes_percentage?: number;
};

export type Step = 1 | 2 | 3;
