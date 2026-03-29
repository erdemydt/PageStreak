import { execute } from "../db/db";

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
};
