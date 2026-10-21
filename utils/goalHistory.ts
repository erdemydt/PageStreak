import { execute, queryAll, queryFirst } from "../db/db";
import {
  dateToLocalDateString,
  getTodayDateString,
  parseDbDate,
} from "./dateUtils";

/**
 * goal_history records the daily reading goal over time, one row per change:
 * (effective_date 'YYYY-MM-DD', minutes). The goal on a given day is the most
 * recent row on or before that day. Streaks and "goal met" checks use it so
 * past days are judged against the goal that applied then, not today's goal.
 */

const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7;
const DEFAULT_GOAL = 30;

export type GoalForDate = (date: string) => number;

/**
 * Record that the daily goal became `minutes` on `effectiveDate` (default today).
 * A second change on the same day replaces the first.
 */
export async function recordGoalChange(
  minutes: number,
  effectiveDate: string = getTodayDateString(),
): Promise<void> {
  await execute(
    "INSERT OR REPLACE INTO goal_history (effective_date, minutes) VALUES (?, ?)",
    [effectiveDate, minutes],
  );
}

/**
 * Load the goal timeline once and return a lookup for any YYYY-MM-DD date.
 * Days before the first recorded change use the earliest known goal.
 */
export async function loadGoalForDate(): Promise<GoalForDate> {
  const rows = await queryAll<{ effective_date: string; minutes: number }>(
    "SELECT effective_date, minutes FROM goal_history ORDER BY effective_date ASC",
  );

  if (rows.length === 0) {
    const prefs = await queryFirst<{
      current_reading_rate_minutes_per_day: number | null;
    }>(
      "SELECT current_reading_rate_minutes_per_day FROM user_preferences WHERE id = 1",
    );
    const goal = prefs?.current_reading_rate_minutes_per_day || DEFAULT_GOAL;
    return () => goal;
  }

  return (date: string) => {
    let goal = rows[0].minutes;
    for (const row of rows) {
      if (row.effective_date > date) break;
      goal = row.minutes;
    }
    return goal;
  };
}

/**
 * For installs that predate goal_history: reconstruct the timeline from the
 * growth plan. The goal started at the initial rate and stepped up by the
 * weekly increase, the last step landing on current_reading_rate_last_updated.
 * Only runs when the table is empty and the user is onboarded.
 */
export async function backfillGoalHistoryIfEmpty(): Promise<void> {
  const existing = await queryFirst<{ count: number }>(
    "SELECT COUNT(*) as count FROM goal_history",
  );
  if ((existing?.count ?? 0) > 0) return;

  const prefs = await queryFirst<{
    created_at: string | null;
    initial_reading_rate_minutes_per_day: number | null;
    current_reading_rate_minutes_per_day: number | null;
    weekly_reading_rate_increase_minutes: number | null;
    current_reading_rate_last_updated: string | null;
  }>(
    `SELECT created_at, initial_reading_rate_minutes_per_day,
            current_reading_rate_minutes_per_day, weekly_reading_rate_increase_minutes,
            current_reading_rate_last_updated
     FROM user_preferences WHERE id = 1`,
  );
  if (!prefs) return;

  const firstSession = await queryFirst<{ first_date: string | null }>(
    "SELECT MIN(date) as first_date FROM reading_sessions",
  );
  const createdAt = parseDbDate(prefs.created_at);
  const candidates = [
    firstSession?.first_date ?? null,
    createdAt ? dateToLocalDateString(createdAt) : null,
  ].filter((date): date is string => !!date);
  const startDate = candidates.sort()[0] ?? getTodayDateString();

  const current = prefs.current_reading_rate_minutes_per_day || DEFAULT_GOAL;
  const initial = prefs.initial_reading_rate_minutes_per_day || current;
  const increase = prefs.weekly_reading_rate_increase_minutes || 0;
  const lastUpdated = parseDbDate(prefs.current_reading_rate_last_updated);

  if (increase <= 0 || current <= initial || !lastUpdated) {
    await recordGoalChange(current, startDate);
    return;
  }

  await recordGoalChange(initial, startDate);
  const steps = Math.ceil((current - initial) / increase);
  for (let step = 1; step <= steps; step++) {
    const stepDate = dateToLocalDateString(
      new Date(lastUpdated.getTime() - (steps - step) * MS_PER_WEEK),
    );
    // Steps reconstructed before the start date collapse into it
    await recordGoalChange(
      Math.min(current, initial + step * increase),
      stepDate > startDate ? stepDate : startDate,
    );
  }
}
