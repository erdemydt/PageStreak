import AsyncStorage from "@react-native-async-storage/async-storage";

export const GOAL_INCREASE_BANNER_EVENT_KEY =
  "@pagestreak/goal-increase-banner-event";
export const GOAL_INCREASE_PROPOSAL_EVENT_KEY =
  "@pagestreak/goal-increase-proposal-event";
export const GOAL_INCREASE_SNOOZE_UNTIL_KEY =
  "@pagestreak/goal-increase-snooze-until";

export type GoalIncreaseBannerEvent = {
  oldGoal: number;
  newGoal: number;
  timestamp: string;
};

export type GoalIncreaseProposalEvent = {
  oldGoal: number;
  newGoal: number;
  checkedAt: string;
};

const isValidNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value);

const isValidIsoString = (value: unknown) => {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const parseStoredJson = <T extends object>(storedValue: string | null) => {
  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue) as Partial<T>;
  } catch {
    return null;
  }
};

export const loadGoalIncreaseBannerEvent =
  async (): Promise<GoalIncreaseBannerEvent | null> => {
    const parsed = parseStoredJson<GoalIncreaseBannerEvent>(
      await AsyncStorage.getItem(GOAL_INCREASE_BANNER_EVENT_KEY),
    );

    if (!parsed) {
      return null;
    }

    if (
      !isValidNumber(parsed.oldGoal) ||
      !isValidNumber(parsed.newGoal) ||
      !isValidIsoString(parsed.timestamp)
    ) {
      await AsyncStorage.removeItem(GOAL_INCREASE_BANNER_EVENT_KEY);
      return null;
    }

    return {
      oldGoal: Number(parsed.oldGoal),
      newGoal: Number(parsed.newGoal),
      timestamp: String(parsed.timestamp),
    };
  };

export const saveGoalIncreaseBannerEvent = async (
  event: GoalIncreaseBannerEvent,
) => {
  await AsyncStorage.setItem(
    GOAL_INCREASE_BANNER_EVENT_KEY,
    JSON.stringify(event),
  );
};

export const clearGoalIncreaseBannerEvent = async () => {
  await AsyncStorage.removeItem(GOAL_INCREASE_BANNER_EVENT_KEY);
};

export const loadGoalIncreaseProposalEvent =
  async (): Promise<GoalIncreaseProposalEvent | null> => {
    const parsed = parseStoredJson<GoalIncreaseProposalEvent>(
      await AsyncStorage.getItem(GOAL_INCREASE_PROPOSAL_EVENT_KEY),
    );

    if (!parsed) {
      return null;
    }

    if (
      !isValidNumber(parsed.oldGoal) ||
      !isValidNumber(parsed.newGoal) ||
      !isValidIsoString(parsed.checkedAt)
    ) {
      await AsyncStorage.removeItem(GOAL_INCREASE_PROPOSAL_EVENT_KEY);
      return null;
    }

    return {
      oldGoal: Number(parsed.oldGoal),
      newGoal: Number(parsed.newGoal),
      checkedAt: String(parsed.checkedAt),
    };
  };

export const saveGoalIncreaseProposalEvent = async (
  event: GoalIncreaseProposalEvent,
) => {
  await AsyncStorage.setItem(
    GOAL_INCREASE_PROPOSAL_EVENT_KEY,
    JSON.stringify(event),
  );
};

export const clearGoalIncreaseProposalEvent = async () => {
  await AsyncStorage.removeItem(GOAL_INCREASE_PROPOSAL_EVENT_KEY);
};

export const loadGoalIncreaseSnoozeUntil = async () => {
  const storedValue = await AsyncStorage.getItem(
    GOAL_INCREASE_SNOOZE_UNTIL_KEY,
  );

  if (!isValidIsoString(storedValue)) {
    return null;
  }

  return storedValue;
};

export const saveGoalIncreaseSnoozeUntil = async (isoDate: string) => {
  await AsyncStorage.setItem(GOAL_INCREASE_SNOOZE_UNTIL_KEY, isoDate);
};

export const clearGoalIncreaseSnoozeUntil = async () => {
  await AsyncStorage.removeItem(GOAL_INCREASE_SNOOZE_UNTIL_KEY);
};

export const isGoalIncreaseSnoozed = (
  snoozeUntilIso: string | null,
  now: Date = new Date(),
) => {
  if (!snoozeUntilIso) {
    return false;
  }

  const snoozeUntil = new Date(snoozeUntilIso);
  if (Number.isNaN(snoozeUntil.getTime())) {
    return false;
  }

  return snoozeUntil.getTime() > now.getTime();
};
