const MILLISECONDS_IN_WEEK = 1000 * 60 * 60 * 24 * 7;
const REQUIRED_GOAL_MET_DAYS = 5;

export type AutoIncreaseAttemptReason =
  | "ready"
  | "auto_disabled"
  | "already_at_target"
  | "invalid_goal_values"
  | "invalid_last_updated"
  | "less_than_one_week";

export type AutoIncreaseAttemptDecision = {
  shouldAttempt: boolean;
  reason: AutoIncreaseAttemptReason;
  weeksSinceLastUpdate: number | null;
};

export type WeeklyConsistencyReason =
  | "eligible"
  | "insufficient_goal_met_days"
  | "invalid_goal_met_days";

export type WeeklyConsistencyDecision = {
  isEligible: boolean;
  reason: WeeklyConsistencyReason;
  goalMetDays: number;
  requiredGoalMetDays: number;
  shortfallDays: number;
};

const parseIsoDate = (isoDate: string): Date | null => {
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const computeWeeksRemaining = (
  targetDateISO: string | null | undefined,
  now: Date = new Date(),
): number => {
  if (!targetDateISO) {
    return 1;
  }

  const targetDate = parseIsoDate(targetDateISO);
  if (!targetDate) {
    return 1;
  }

  const diffMs = targetDate.getTime() - now.getTime();
  const rawWeeks = Math.ceil(diffMs / MILLISECONDS_IN_WEEK);

  return Math.max(1, rawWeeks);
};

export const computeFixedIncrement = (
  current: number,
  target: number,
  weeksRemaining: number,
): number => {
  if (!Number.isFinite(current) || !Number.isFinite(target)) {
    return 0;
  }

  const currentGoal = Math.max(0, Math.floor(current));
  const targetGoal = Math.max(0, Math.floor(target));

  if (targetGoal <= currentGoal) {
    return 0;
  }

  const normalizedWeeks =
    Number.isFinite(weeksRemaining) && weeksRemaining > 0
      ? Math.floor(weeksRemaining)
      : 1;

  const safeWeeks = Math.max(1, normalizedWeeks);
  return Math.max(1, Math.ceil((targetGoal - currentGoal) / safeWeeks));
};

export const shouldAttemptAutoIncrease = (
  autoEnabled: boolean | number | null | undefined,
  current: number,
  target: number,
  lastUpdatedISO: string | null | undefined,
  now: Date = new Date(),
): AutoIncreaseAttemptDecision => {
  const isAutoEnabled = autoEnabled === true || autoEnabled === 1;

  if (!isAutoEnabled) {
    return {
      shouldAttempt: false,
      reason: "auto_disabled",
      weeksSinceLastUpdate: null,
    };
  }

  if (
    !Number.isFinite(current) ||
    !Number.isFinite(target) ||
    current <= 0 ||
    target <= 0
  ) {
    return {
      shouldAttempt: false,
      reason: "invalid_goal_values",
      weeksSinceLastUpdate: null,
    };
  }

  if (current >= target) {
    return {
      shouldAttempt: false,
      reason: "already_at_target",
      weeksSinceLastUpdate: null,
    };
  }

  if (!lastUpdatedISO) {
    return {
      shouldAttempt: true,
      reason: "ready",
      weeksSinceLastUpdate: null,
    };
  }

  const lastUpdatedDate = parseIsoDate(lastUpdatedISO);
  if (!lastUpdatedDate) {
    return {
      shouldAttempt: false,
      reason: "invalid_last_updated",
      weeksSinceLastUpdate: null,
    };
  }

  const weeksSinceLastUpdate =
    (now.getTime() - lastUpdatedDate.getTime()) / MILLISECONDS_IN_WEEK;

  if (weeksSinceLastUpdate < 1) {
    return {
      shouldAttempt: false,
      reason: "less_than_one_week",
      weeksSinceLastUpdate,
    };
  }

  return {
    shouldAttempt: true,
    reason: "ready",
    weeksSinceLastUpdate,
  };
};

export const evaluateWeeklyConsistency = (
  goalMetDays: number,
): WeeklyConsistencyDecision => {
  if (!Number.isFinite(goalMetDays) || goalMetDays < 0 || goalMetDays > 7) {
    return {
      isEligible: false,
      reason: "invalid_goal_met_days",
      goalMetDays,
      requiredGoalMetDays: REQUIRED_GOAL_MET_DAYS,
      shortfallDays: REQUIRED_GOAL_MET_DAYS,
    };
  }

  if (goalMetDays >= REQUIRED_GOAL_MET_DAYS) {
    return {
      isEligible: true,
      reason: "eligible",
      goalMetDays,
      requiredGoalMetDays: REQUIRED_GOAL_MET_DAYS,
      shortfallDays: 0,
    };
  }

  return {
    isEligible: false,
    reason: "insufficient_goal_met_days",
    goalMetDays,
    requiredGoalMetDays: REQUIRED_GOAL_MET_DAYS,
    shortfallDays: REQUIRED_GOAL_MET_DAYS - goalMetDays,
  };
};
