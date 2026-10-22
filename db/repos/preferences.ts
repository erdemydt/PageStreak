import type { UserPreferences } from "../../types/models";
import { emitDataChange } from "../../utils/dataEvents";
import { recordGoalChange } from "../../utils/goalHistory";
import { execute, queryFirst, runInTransaction } from "../db";

const DEFAULT_DAILY_GOAL = 30;

/** The single preferences row (id = 1); null means "not onboarded" */
export async function getUserPreferences(): Promise<UserPreferences | null> {
  return queryFirst<UserPreferences>(
    "SELECT * FROM user_preferences WHERE id = 1",
  );
}

/** Today's daily reading goal in minutes */
export async function getDailyGoal(): Promise<number> {
  const prefs = await queryFirst<{
    current_reading_rate_minutes_per_day: number | null;
  }>(
    "SELECT current_reading_rate_minutes_per_day FROM user_preferences WHERE id = 1",
  );
  return prefs?.current_reading_rate_minutes_per_day || DEFAULT_DAILY_GOAL;
}

export type OnboardingInput = {
  username: string;
  yearlyBookGoal: number;
  preferredGenres: string[];
  initialRate: number;
  targetRate: number;
  targetDate: string;
  weeklyIncreaseMinutes: number;
  weeklyIncreasePercentage: number;
};

/** Create (or replace) the preferences row and start the goal history */
export async function saveOnboardingPreferences(
  input: OnboardingInput,
): Promise<void> {
  await runInTransaction(async () => {
    await execute(
      `INSERT OR REPLACE INTO user_preferences (
        id, username, yearly_book_goal, preferred_genres, updated_at,
        weekly_reading_goal,
        initial_reading_rate_minutes_per_day, end_reading_rate_goal_minutes_per_day,
        end_reading_rate_goal_date, current_reading_rate_minutes_per_day,
        current_reading_rate_last_updated, weekly_reading_rate_increase_minutes,
        weekly_reading_rate_increase_minutes_percentage
      ) VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.username,
        input.yearlyBookGoal,
        input.preferredGenres.join(","),
        input.initialRate * 7,
        input.initialRate,
        input.targetRate,
        input.targetDate,
        input.initialRate, // current rate starts at the initial rate
        new Date().toISOString(),
        input.weeklyIncreaseMinutes,
        input.weeklyIncreasePercentage,
      ],
    );
    await recordGoalChange(input.initialRate);
  });
  emitDataChange("preferences");
}

/** Rename the user (Settings) */
export async function updateUsername(username: string): Promise<void> {
  await execute(
    "UPDATE user_preferences SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    [username],
  );
  emitDataChange("preferences");
}

/** Books to finish this year; 0 means no goal set (Progress) */
export async function setYearlyBookGoal(goal: number): Promise<void> {
  await execute(
    "UPDATE user_preferences SET yearly_book_goal = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    [goal],
  );
  emitDataChange("preferences");
}
