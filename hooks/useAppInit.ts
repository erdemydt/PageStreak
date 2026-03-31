import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  checkNotificationDatabaseIntegrity,
  initializeDatabase,
  queryFirst,
  repairNotificationDatabase,
} from "../db/db";
import NotificationService from "../services/notificationService";
import type { UserPreferences } from "../types/database";
import {
  isGoalIncreaseSnoozed,
  loadGoalIncreaseProposalEvent,
  loadGoalIncreaseSnoozeUntil,
  saveGoalIncreaseProposalEvent,
} from "../utils/goalIncreaseEvents";
import { useGoalIncrease } from "./useGoalIncrease";

export const useAppInit = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { evaluateGoalIncreaseOpportunity } = useGoalIncrease();

  const checkUserSetup = useCallback(async () => {
    try {
      const user = await queryFirst<UserPreferences>(
        "SELECT * FROM user_preferences WHERE id = 1",
      );

      if (user) {
        router.replace("/(tabs)/(home)");
      } else {
        router.replace("/intro");
      }
    } catch (error) {
      console.error("❌ Error checking user setup:", error);
      router.replace("/intro");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initializeAppDatabase = useCallback(async () => {
    try {
      console.log("🔄 Starting app database initialization...");

      await initializeDatabase();
      console.log("✅ Database tables initialized");

      const dbIntegrity = await checkNotificationDatabaseIntegrity();
      console.log("📊 Database integrity check:", dbIntegrity);

      if (
        !dbIntegrity.notification_preferences_exists ||
        !dbIntegrity.notification_preferences_has_defaults
      ) {
        console.log("🔧 Repairing notification database...");
        await repairNotificationDatabase();
      }

      try {
        await NotificationService.reset();

        const notificationPrefs =
          await NotificationService.getNotificationPreferences();
        console.log("🔔 Notification preferences initialized:", {
          enabled: notificationPrefs?.notifications_enabled,
          reminders: notificationPrefs?.daily_reminder_enabled,
          hours: notificationPrefs?.daily_reminder_hours_after_last_open,
        });

        await NotificationService.syncPermissionsWithDatabase();

        console.log(
          "✅ Notification service initialized and permissions synced",
        );
      } catch (notificationError) {
        console.error(
          "⚠️ Notification service initialization failed, continuing without notifications:",
          notificationError,
        );
      }

      const goalIncreaseResult = await evaluateGoalIncreaseOpportunity();
      if (goalIncreaseResult.eligible) {
        const oldGoal = goalIncreaseResult.oldGoal;
        const newGoal = goalIncreaseResult.newGoal;

        if (
          typeof oldGoal === "number" &&
          typeof newGoal === "number" &&
          newGoal > oldGoal
        ) {
          try {
            const [existingProposal, snoozeUntilIso] = await Promise.all([
              loadGoalIncreaseProposalEvent(),
              loadGoalIncreaseSnoozeUntil(),
            ]);

            if (isGoalIncreaseSnoozed(snoozeUntilIso)) {
              console.log("ℹ️ Goal increase prompt is snoozed", {
                snoozeUntilIso,
              });
            } else if (
              existingProposal &&
              existingProposal.oldGoal === oldGoal &&
              existingProposal.newGoal === newGoal
            ) {
              console.log("ℹ️ Goal increase proposal already pending");
            } else {
              await saveGoalIncreaseProposalEvent({
                oldGoal,
                newGoal,
                checkedAt: goalIncreaseResult.checkedAt,
              });
              console.log(
                `✅ Goal increase proposal created: ${oldGoal} -> ${newGoal} min/day`,
              );
            }
          } catch (storageError) {
            console.error(
              "⚠️ Failed to persist goal increase proposal:",
              storageError,
            );
          }
        } else {
          console.warn(
            "⚠️ Skipping goal increase proposal due to invalid payload",
            {
              oldGoal,
              newGoal,
              reason: goalIncreaseResult.reason,
            },
          );
        }
      } else {
        console.log("ℹ️ Goal increase skipped:", {
          reason: goalIncreaseResult.reason,
          oldGoal: goalIncreaseResult.oldGoal,
          newGoal: goalIncreaseResult.newGoal,
          goalMetDays: goalIncreaseResult.goalMetDays,
          requiredGoalMetDays: goalIncreaseResult.requiredGoalMetDays,
          weeksRemaining: goalIncreaseResult.weeksRemaining,
          increment: goalIncreaseResult.increment,
          error: goalIncreaseResult.error,
        });
      }

      await checkUserSetup();
    } catch (error) {
      console.error("❌ Failed to initialize app database:", error);
      router.replace("/intro");
      setIsLoading(false);
    }
  }, [checkUserSetup, evaluateGoalIncreaseOpportunity]);

  useEffect(() => {
    initializeAppDatabase();
  }, [initializeAppDatabase]);

  return {
    isLoading,
  };
};
