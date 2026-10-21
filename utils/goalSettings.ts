import db, { execute, queryFirst } from "../db/db";
import { parseDbDate } from "./dateUtils";
import { recordGoalChange } from "./goalHistory";

const MAX_DAILY_MINUTES = 480;

const DD_MM_YYYY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export type GrowthGoalsInput = {
  currentDailyGoal: number;
  targetDailyGoal: number;
  targetDate?: string | null;
};

export type GrowthGoalValidationError =
  | "current_daily_required"
  | "target_daily_required"
  | "current_daily_range"
  | "target_daily_range"
  | "target_before_current";

export type GrowthGoalComputation = {
  weeklyReadingGoal: number;
  initialReadingRate: number;
  currentReadingRate: number;
  targetReadingRate: number;
  endGoalDate: string;
  weeklyIncreaseMinutes: number;
  weeklyIncreasePercentage: number;
};

const endOfYearIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).toISOString();
};

const normalizeTargetDate = (targetDate?: string | null) => {
  if (!targetDate) {
    return endOfYearIso();
  }

  const normalizedInput = targetDate.trim();
  const ddMmMatch = normalizedInput.match(DD_MM_YYYY_PATTERN);

  let parsed: Date;
  if (ddMmMatch) {
    const [, day, month, year] = ddMmMatch;
    parsed = new Date(`${year}-${month}-${day}T00:00:00`);
  } else {
    parsed = new Date(normalizedInput);
  }

  if (Number.isNaN(parsed.getTime())) {
    return endOfYearIso();
  }

  parsed.setHours(23, 59, 59, 999);
  return parsed.toISOString();
};

const calculateWeeksUntilTarget = (targetDateIso: string) => {
  const now = new Date();
  const targetDate = new Date(targetDateIso);
  const diffMs = targetDate.getTime() - now.getTime();
  const diffWeeks = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));
  return Math.max(1, diffWeeks);
};

export const validateGrowthGoals = (
  input: GrowthGoalsInput,
): GrowthGoalValidationError | null => {
  if (!Number.isFinite(input.currentDailyGoal)) {
    return "current_daily_required";
  }

  if (!Number.isFinite(input.targetDailyGoal)) {
    return "target_daily_required";
  }

  if (
    input.currentDailyGoal <= 0 ||
    input.currentDailyGoal > MAX_DAILY_MINUTES
  ) {
    return "current_daily_range";
  }

  if (input.targetDailyGoal <= 0 || input.targetDailyGoal > MAX_DAILY_MINUTES) {
    return "target_daily_range";
  }

  if (input.targetDailyGoal < input.currentDailyGoal) {
    return "target_before_current";
  }

  return null;
};

export const computeGrowthGoalFields = (
  input: GrowthGoalsInput,
): GrowthGoalComputation => {
  const endGoalDate = normalizeTargetDate(input.targetDate);
  const totalIncrease = Math.max(
    0,
    input.targetDailyGoal - input.currentDailyGoal,
  );
  const weeksUntilTarget = calculateWeeksUntilTarget(endGoalDate);
  const weeklyIncreaseMinutes =
    totalIncrease > 0 ? Math.ceil(totalIncrease / weeksUntilTarget) : 0;
  const weeklyIncreasePercentage =
    input.currentDailyGoal > 0
      ? (weeklyIncreaseMinutes / input.currentDailyGoal) * 100
      : 0;

  return {
    weeklyReadingGoal: input.currentDailyGoal * 7,
    initialReadingRate: input.currentDailyGoal,
    currentReadingRate: input.currentDailyGoal,
    targetReadingRate: input.targetDailyGoal,
    endGoalDate,
    weeklyIncreaseMinutes,
    weeklyIncreasePercentage,
  };
};

export const updateGrowthGoals = async (input: GrowthGoalsInput) => {
  const computed = computeGrowthGoalFields(input);

  // Preferences and goal history change together or not at all
  await db.withTransactionAsync(async () => {
    await execute(
      `UPDATE user_preferences SET
      weekly_reading_goal = ?,
      initial_reading_rate_minutes_per_day = ?,
      current_reading_rate_minutes_per_day = ?,
      current_reading_rate_last_updated = ?,
      end_reading_rate_goal_minutes_per_day = ?,
      end_reading_rate_goal_date = ?,
      weekly_reading_rate_increase_minutes = ?,
      weekly_reading_rate_increase_minutes_percentage = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1`,
      [
        computed.weeklyReadingGoal,
        computed.initialReadingRate,
        computed.currentReadingRate,
        new Date().toISOString(),
        computed.targetReadingRate,
        computed.endGoalDate,
        computed.weeklyIncreaseMinutes,
        computed.weeklyIncreasePercentage,
      ],
    );
    await recordGoalChange(computed.currentReadingRate);
  });
};

const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7;

/**
 * Grows the daily goal toward the target, linearly by
 * weekly_reading_rate_increase_minutes per full week since
 * current_reading_rate_last_updated (the same model the Growth Journey chart
 * shows). Catches up missed weeks, never overshoots the target, and stops
 * after the goal date. Runs on cold start and when the app becomes active.
 *
 * The new goal is recorded in goal_history as effective *today*: the user
 * never saw the intermediate goals, so past days keep the goal they had.
 */
export const applyWeeklyGoalGrowth = async (): Promise<void> => {
  try {
    const prefs = await queryFirst<{
      current_reading_rate_minutes_per_day: number | null;
      end_reading_rate_goal_minutes_per_day: number | null;
      end_reading_rate_goal_date: string | null;
      current_reading_rate_last_updated: string | null;
      weekly_reading_rate_increase_minutes: number | null;
    }>(
      `SELECT current_reading_rate_minutes_per_day, end_reading_rate_goal_minutes_per_day,
              end_reading_rate_goal_date, current_reading_rate_last_updated,
              weekly_reading_rate_increase_minutes
       FROM user_preferences WHERE id = 1`,
    );
    if (!prefs) return;

    const lastUpdated = parseDbDate(prefs.current_reading_rate_last_updated);
    if (!lastUpdated) {
      // No usable baseline yet; start counting weeks from now
      await execute(
        "UPDATE user_preferences SET current_reading_rate_last_updated = ? WHERE id = 1",
        [new Date().toISOString()],
      );
      return;
    }

    const weeksPassed = Math.floor(
      (Date.now() - lastUpdated.getTime()) / MS_PER_WEEK,
    );
    const goalDate = parseDbDate(prefs.end_reading_rate_goal_date);
    const currentRate = prefs.current_reading_rate_minutes_per_day || 30;
    const targetRate =
      prefs.end_reading_rate_goal_minutes_per_day || currentRate;
    // 0 is meaningful here (target == current): don't replace it with a default
    const weeklyIncrease = prefs.weekly_reading_rate_increase_minutes ?? 0;

    if (
      weeksPassed <= 0 ||
      !goalDate ||
      goalDate <= new Date() ||
      weeklyIncrease <= 0 ||
      currentRate >= targetRate
    ) {
      return;
    }

    const newRate = Math.min(
      targetRate,
      Math.round(currentRate + weeklyIncrease * weeksPassed),
    );
    // Advance the baseline by whole weeks so a partial week isn't lost
    const newLastUpdated = new Date(
      lastUpdated.getTime() + weeksPassed * MS_PER_WEEK,
    );

    await db.withTransactionAsync(async () => {
      await execute(
        "UPDATE user_preferences SET current_reading_rate_minutes_per_day = ?, current_reading_rate_last_updated = ? WHERE id = 1",
        [newRate, newLastUpdated.toISOString()],
      );
      await recordGoalChange(newRate);
    });
  } catch (error) {
    console.error("❌ Failed to apply weekly goal growth:", error);
  }
};
