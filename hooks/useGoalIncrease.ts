import { useCallback } from "react";
import { execute, queryFirst } from "../db/db";
import type { UserPreferences } from "../types/database";
import {
  computeFixedIncrement,
  computeWeeksRemaining,
  evaluateWeeklyConsistency,
  shouldAttemptAutoIncrease,
} from "../utils/goalIncrease";
import type { GoalIncreaseProposalEvent } from "../utils/goalIncreaseEvents";

type GoalMetDaysRow = {
  goal_met_days: number;
};

export type GoalIncreaseResultReason =
  | "eligible"
  | "no_user_preferences"
  | "no_increment_needed"
  | "update_failed"
  | "stale_or_ineligible"
  | "proposal_outdated"
  | ReturnType<typeof shouldAttemptAutoIncrease>["reason"]
  | ReturnType<typeof evaluateWeeklyConsistency>["reason"];

export type GoalIncreaseEvaluationResult = {
  eligible: boolean;
  oldGoal: number | null;
  newGoal: number | null;
  reason: GoalIncreaseResultReason;
  checkedAt: string;
  goalMetDays?: number;
  requiredGoalMetDays?: number;
  weeksRemaining?: number;
  increment?: number;
  weeksSinceLastUpdate?: number | null;
  error?: string;
};

export type GoalIncreaseApplyResult = {
  applied: boolean;
  oldGoal: number | null;
  newGoal: number | null;
  reason: GoalIncreaseResultReason;
  checkedAt: string;
  error?: string;
};

const getGoalMetDaysInPastWeek = async (dailyGoal: number): Promise<number> => {
  const result = await queryFirst<GoalMetDaysRow>(
    `SELECT COUNT(*) AS goal_met_days
     FROM (
       SELECT date
       FROM reading_sessions
       WHERE date BETWEEN date('now', 'localtime', '-6 days') AND date('now', 'localtime')
       GROUP BY date
       HAVING SUM(minutes_read) >= ?
     )`,
    [dailyGoal],
  );

  return Number(result?.goal_met_days ?? 0);
};

export const useGoalIncrease = () => {
  const evaluateGoalIncreaseOpportunity =
    useCallback(async (): Promise<GoalIncreaseEvaluationResult> => {
      const checkedAt = new Date().toISOString();

      try {
        const user = await queryFirst<UserPreferences>(
          `SELECT
            auto_increase_enabled,
            initial_reading_rate_minutes_per_day,
            current_reading_rate_minutes_per_day,
            current_reading_rate_last_updated,
            end_reading_rate_goal_minutes_per_day,
            end_reading_rate_goal_date
           FROM user_preferences
           WHERE id = 1`,
        );

        if (!user) {
          return {
            eligible: false,
            oldGoal: null,
            newGoal: null,
            reason: "no_user_preferences",
            checkedAt,
          };
        }

        const currentGoalRaw =
          user.current_reading_rate_minutes_per_day ??
          user.initial_reading_rate_minutes_per_day ??
          30;
        const targetGoalRaw =
          user.end_reading_rate_goal_minutes_per_day ?? currentGoalRaw;

        const currentGoal = Math.round(currentGoalRaw);
        const targetGoal = Math.round(targetGoalRaw);

        const attemptDecision = shouldAttemptAutoIncrease(
          user.auto_increase_enabled ?? 1,
          currentGoal,
          targetGoal,
          user.current_reading_rate_last_updated ?? null,
          new Date(checkedAt),
        );

        if (!attemptDecision.shouldAttempt) {
          return {
            eligible: false,
            oldGoal: currentGoal,
            newGoal: currentGoal+5,
            reason: attemptDecision.reason,
            checkedAt,
            weeksSinceLastUpdate: attemptDecision.weeksSinceLastUpdate,
          };
        }

        const goalMetDays = await getGoalMetDaysInPastWeek(currentGoal);
        const consistencyDecision = evaluateWeeklyConsistency(goalMetDays);

        if (!consistencyDecision.isEligible) {
          return {
            eligible: false,
            oldGoal: currentGoal,
            newGoal: currentGoal,
            reason: consistencyDecision.reason,
            checkedAt,
            goalMetDays,
            requiredGoalMetDays: consistencyDecision.requiredGoalMetDays,
          };
        }

        const weeksRemaining = computeWeeksRemaining(
          user.end_reading_rate_goal_date ?? null,
          new Date(checkedAt),
        );
        const increment = computeFixedIncrement(
          currentGoal,
          targetGoal,
          weeksRemaining,
        );

        if (increment <= 0) {
          return {
            eligible: false,
            oldGoal: currentGoal,
            newGoal: currentGoal,
            reason: "no_increment_needed",
            checkedAt,
            goalMetDays,
            requiredGoalMetDays: consistencyDecision.requiredGoalMetDays,
            weeksRemaining,
            increment,
          };
        }

        const updatedGoal = Math.min(targetGoal, currentGoal + increment);
        if (updatedGoal <= currentGoal) {
          return {
            eligible: false,
            oldGoal: currentGoal,
            newGoal: currentGoal,
            reason: "no_increment_needed",
            checkedAt,
            goalMetDays,
            requiredGoalMetDays: consistencyDecision.requiredGoalMetDays,
            weeksRemaining,
            increment,
          };
        }

        return {
          eligible: true,
          oldGoal: currentGoal,
          newGoal: updatedGoal,
          reason: "eligible",
          checkedAt,
          goalMetDays,
          requiredGoalMetDays: consistencyDecision.requiredGoalMetDays,
          weeksRemaining,
          increment,
          weeksSinceLastUpdate: attemptDecision.weeksSinceLastUpdate,
        };
      } catch (error) {
        console.error("❌ Goal increase evaluation failed:", error);

        return {
          eligible: false,
          oldGoal: null,
          newGoal: null,
          reason: "update_failed",
          checkedAt,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }, []);

  const applyGoalIncreaseProposal = useCallback(
    async (
      proposal: GoalIncreaseProposalEvent,
    ): Promise<GoalIncreaseApplyResult> => {
      const checkedAt = new Date().toISOString();

      try {
        const latestEvaluation = await evaluateGoalIncreaseOpportunity();

        if (!latestEvaluation.eligible) {
          return {
            applied: false,
            oldGoal: latestEvaluation.oldGoal,
            newGoal: latestEvaluation.newGoal,
            reason: "stale_or_ineligible",
            checkedAt,
          };
        }

        const expectedOldGoal = latestEvaluation.oldGoal;
        const expectedNewGoal = latestEvaluation.newGoal;

        if (
          expectedOldGoal !== proposal.oldGoal ||
          expectedNewGoal !== proposal.newGoal
        ) {
          return {
            applied: false,
            oldGoal: expectedOldGoal,
            newGoal: expectedNewGoal,
            reason: "proposal_outdated",
            checkedAt,
          };
        }

        await execute(
          `UPDATE user_preferences
           SET current_reading_rate_minutes_per_day = ?,
               current_reading_rate_last_updated = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = 1`,
          [proposal.newGoal, checkedAt],
        );

        return {
          applied: true,
          oldGoal: proposal.oldGoal,
          newGoal: proposal.newGoal,
          reason: "eligible",
          checkedAt,
        };
      } catch (error) {
        console.error("❌ Goal increase apply failed:", error);
        return {
          applied: false,
          oldGoal: proposal.oldGoal,
          newGoal: proposal.newGoal,
          reason: "update_failed",
          checkedAt,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [evaluateGoalIncreaseOpportunity],
  );

  return {
    evaluateGoalIncreaseOpportunity,
    applyGoalIncreaseProposal,
  };
};
