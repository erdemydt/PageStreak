import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useGoalIncrease } from "./useGoalIncrease";

const GOAL_INCREASE_BANNER_EVENT_KEY = "@pagestreak/goal-increase-banner-event";

type GoalIncreaseBannerEvent = {
  oldGoal: number;
  newGoal: number;
  timestamp: string;
};

export const useAppInit = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { evaluateAndApplyGoalIncrease } = useGoalIncrease();

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

      const goalIncreaseResult = await evaluateAndApplyGoalIncrease();
      if (goalIncreaseResult.increased) {
        const oldGoal = goalIncreaseResult.oldGoal;
        const newGoal = goalIncreaseResult.newGoal;

        if (
          typeof oldGoal === "number" &&
          typeof newGoal === "number" &&
          newGoal > oldGoal
        ) {
          const goalIncreaseEvent: GoalIncreaseBannerEvent = {
            oldGoal,
            newGoal,
            timestamp: goalIncreaseResult.checkedAt,
          };

          try {
            await AsyncStorage.setItem(
              GOAL_INCREASE_BANNER_EVENT_KEY,
              JSON.stringify(goalIncreaseEvent),
            );
          } catch (storageError) {
            console.error(
              "⚠️ Failed to persist goal increase event:",
              storageError,
            );
          }
        } else {
          console.warn(
            "⚠️ Skipping goal increase event persistence due to invalid payload",
            {
              oldGoal,
              newGoal,
              reason: goalIncreaseResult.reason,
            },
          );
        }

        console.log(
          `✅ Goal increased: ${goalIncreaseResult.oldGoal} -> ${goalIncreaseResult.newGoal} min/day`,
        );
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
  }, [checkUserSetup, evaluateAndApplyGoalIncrease]);

  useEffect(() => {
    initializeAppDatabase();
  }, [initializeAppDatabase]);

  return {
    isLoading,
  };
};
