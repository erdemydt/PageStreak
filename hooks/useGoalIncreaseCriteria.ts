import { useCallback, useEffect, useState } from "react";
import { queryFirst } from "../db/db";
import { evaluateWeeklyConsistency } from "../utils/goalIncrease";

type GoalMetDaysRow = {
  goal_met_days: number;
};

type ActiveDaysRow = {
  active_days: number;
};

type UserCriteriaRow = {
  auto_increase_enabled?: number;
  current_reading_rate_minutes_per_day?: number;
  initial_reading_rate_minutes_per_day?: number;
};

export type GoalIncreaseCriteriaState = {
  loading: boolean;
  hasUserPreferences: boolean;
  autoIncreaseEnabled: boolean;
  currentDailyGoal: number | null;
  goalMetDays: number;
  activeDays: number;
  requiredGoalMetDays: number;
  windowDays: number;
};

const WINDOW_DAYS = 7;
const REQUIRED_GOAL_MET_DAYS = evaluateWeeklyConsistency(0).requiredGoalMetDays;

const defaultState: GoalIncreaseCriteriaState = {
  loading: true,
  hasUserPreferences: false,
  autoIncreaseEnabled: true,
  currentDailyGoal: null,
  goalMetDays: 0,
  activeDays: 0,
  requiredGoalMetDays: REQUIRED_GOAL_MET_DAYS,
  windowDays: WINDOW_DAYS,
};

export const useGoalIncreaseCriteria = () => {
  const [state, setState] = useState<GoalIncreaseCriteriaState>(defaultState);

  const loadCriteria = useCallback(async () => {
    setState((previous) => ({
      ...previous,
      loading: true,
    }));

    try {
      const user = await queryFirst<UserCriteriaRow>(
        `SELECT
          auto_increase_enabled,
          current_reading_rate_minutes_per_day,
          initial_reading_rate_minutes_per_day
         FROM user_preferences
         WHERE id = 1`,
      );

      if (!user) {
        setState({
          ...defaultState,
          loading: false,
        });
        return;
      }

      const currentDailyGoal = Math.max(
        1,
        Math.round(
          user.current_reading_rate_minutes_per_day ??
            user.initial_reading_rate_minutes_per_day ??
            30,
        ),
      );

      const [goalMetResult, activeDaysResult] = await Promise.all([
        queryFirst<GoalMetDaysRow>(
          `SELECT COUNT(*) AS goal_met_days
           FROM (
             SELECT date
             FROM reading_sessions
             WHERE date BETWEEN date('now', 'localtime', '-6 days') AND date('now', 'localtime')
             GROUP BY date
             HAVING SUM(minutes_read) >= ?
           )`,
          [currentDailyGoal],
        ),
        queryFirst<ActiveDaysRow>(
          `SELECT COUNT(DISTINCT date) AS active_days
           FROM reading_sessions
           WHERE date BETWEEN date('now', 'localtime', '-6 days') AND date('now', 'localtime')`,
        ),
      ]);

      setState({
        loading: false,
        hasUserPreferences: true,
        autoIncreaseEnabled: user.auto_increase_enabled !== 0,
        currentDailyGoal,
        goalMetDays: Number(goalMetResult?.goal_met_days ?? 0),
        activeDays: Number(activeDaysResult?.active_days ?? 0),
        requiredGoalMetDays: REQUIRED_GOAL_MET_DAYS,
        windowDays: WINDOW_DAYS,
      });
    } catch (error) {
      console.error("Failed to load goal increase criteria:", error);
      setState((previous) => ({
        ...previous,
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    loadCriteria();
  }, [loadCriteria]);

  return {
    ...state,
    reloadCriteria: loadCriteria,
  };
};
