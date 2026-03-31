import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import {
    checkNotificationDatabaseIntegrity,
    initializeDatabase,
    queryFirst,
    repairNotificationDatabase,
} from "../db/db";
import { useGoalIncrease } from "../hooks/useGoalIncrease";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import type { UserPreferences } from "../types/database";

const GOAL_INCREASE_BANNER_EVENT_KEY = "@pagestreak/goal-increase-banner-event";

type GoalIncreaseBannerEvent = {
  oldGoal: number;
  newGoal: number;
  timestamp: string;
};

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const { evaluateAndApplyGoalIncrease } = useGoalIncrease();

  useEffect(() => {
    initializeAppDatabase();
  }, []);

  const initializeAppDatabase = async () => {
    try {
      console.log("🔄 Starting app database initialization...");

      // Initialize all database tables first
      await initializeDatabase();
      console.log("✅ Database tables initialized");

      // Verify database integrity before proceeding
      const dbIntegrity = await checkNotificationDatabaseIntegrity();
      console.log("📊 Database integrity check:", dbIntegrity);

      // If notification tables are missing, repair them
      if (
        !dbIntegrity.notification_preferences_exists ||
        !dbIntegrity.notification_preferences_has_defaults
      ) {
        console.log("🔧 Repairing notification database...");
        await repairNotificationDatabase();
      }

      // Initialize notification service after database is verified
      try {
        await NotificationService.reset();

        // Get or create notification preferences (this will handle first-time permission request)
        const notificationPrefs =
          await NotificationService.getNotificationPreferences();
        console.log("🔔 Notification preferences initialized:", {
          enabled: notificationPrefs?.notifications_enabled,
          reminders: notificationPrefs?.daily_reminder_enabled,
          hours: notificationPrefs?.daily_reminder_hours_after_last_open,
        });

        // Sync system permissions with database preferences
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

      // Then check user setup and handle navigation
      await checkUserSetup();
    } catch (error) {
      console.error("❌ Failed to initialize app database:", error);
      // If database initialization fails, still try to show intro
      router.replace("/intro");
      setIsLoading(false);
    }
  };

  const checkUserSetup = async () => {
    try {
      const user = await queryFirst<UserPreferences>(
        "SELECT * FROM user_preferences WHERE id = 1",
      );

      // Automatically navigate based on user status
      if (user) {
        router.replace("/(tabs)/(home)");
      } else {
        router.replace("/intro");
      }
    } catch (error) {
      console.error("❌ Error checking user setup:", error);
      // If table doesn't exist or error, show intro
      router.replace("/intro");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require("../assets/images/Logo.png")}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <Text style={styles.loadingText}>PageStreak</Text>
      </View>
    );
  }

  // This component will only briefly show while navigation is happening
  return (
    <View style={styles.loadingContainer}>
      <Image
        source={require("../assets/images/Logo.png")}
        style={styles.loadingLogo}
        resizeMode="contain"
      />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.neutral[50],
  },
  loadingLogo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.neutral[800],
  },
});
