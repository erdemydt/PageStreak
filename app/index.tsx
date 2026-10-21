import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import {
    checkNotificationDatabaseIntegrity,
    execute,
    initializeDatabase,
    queryFirst,
    repairNotificationDatabase,
} from "../db/db";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import { parseDbDate } from "../utils/dateUtils";

const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7;

type UserPreferences = {
  id: number;
  username: string;
  yearly_book_goal: number;
  preferred_genres?: string;
  created_at?: string;
  updated_at?: string;
  weekly_reading_goal?: number;
  initial_reading_rate_minutes_per_day?: number;
  end_reading_rate_goal_minutes_per_day?: number;
  end_reading_rate_goal_date?: string;
  current_reading_rate_minutes_per_day?: number;
  current_reading_rate_last_updated?: string;
  weekly_reading_rate_increase_minutes?: number;
  weekly_reading_rate_increase_minutes_percentage?: number;
};

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasUser, setHasUser] = useState(false);

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

      // Grow the daily goal before navigating, so the home screen shows the
      // up-to-date goal on first render
      await initiateWeeklyProgressLogic();

      // Then check user setup and handle navigation
      await checkUserSetup();
    } catch (error) {
      console.error("❌ Failed to initialize app database:", error);
      // If database initialization fails, still try to show intro
      setHasUser(false);
      router.replace("/intro");
      setIsLoading(false);
    }
  };

  /**
   * Grows the daily reading goal toward the target, linearly by
   * weekly_reading_rate_increase_minutes per elapsed week (the same model the
   * Growth Journey chart projects). Catches up if several weeks passed since
   * the last launch and never overshoots the target.
   */
  const initiateWeeklyProgressLogic = async () => {
    try {
      const info = await getUserGoalInformation();
      if (!info) return;

      const lastUpdated = parseDbDate(info.current_reading_rate_last_updated);
      if (!lastUpdated) {
        // No usable baseline yet; start counting weeks from now
        await execute(
          "UPDATE user_preferences SET current_reading_rate_last_updated = ? WHERE id = 1",
          [new Date().toISOString()],
        );
        return;
      }

      const weeksPassed = getWeeksPassed(lastUpdated);
      const goalDate = parseDbDate(info.end_reading_rate_goal_date);
      const currentRate = info.current_reading_rate_minutes_per_day;
      const targetRate = info.end_reading_rate_goal_minutes_per_day;
      const weeklyIncrease = info.weekly_reading_rate_increase_minutes;

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

      await execute(
        "UPDATE user_preferences SET current_reading_rate_minutes_per_day = ?, current_reading_rate_last_updated = ? WHERE id = 1",
        [newRate, newLastUpdated.toISOString()],
      );
      console.log(
        `✅ Daily goal grew from ${currentRate} to ${newRate} minutes (${weeksPassed} week(s) passed)`,
      );
    } catch (error) {
      console.error("❌ Failed to initialize weekly progress logic:", error);
    }
  };

  const checkUserSetup = async () => {
    try {
      const user = await queryFirst<UserPreferences>(
        "SELECT * FROM user_preferences WHERE id = 1",
      );
      setHasUser(!!user);

      // Automatically navigate based on user status
      if (user) {
        router.replace("/(tabs)/(home)");
      } else {
        router.replace("/intro");
      }
    } catch (error) {
      console.error("❌ Error checking user setup:", error);
      // If table doesn't exist or error, show intro
      setHasUser(false);
      router.replace("/intro");
    } finally {
      setIsLoading(false);
    }
  };

  const getWeeksPassed = (startDate: Date) => {
    const diffInMs = Date.now() - startDate.getTime();
    return Math.floor(diffInMs / MS_PER_WEEK);
  };

  const getUserGoalInformation = async () => {
    try {
      const user = await queryFirst<UserPreferences>(
        "SELECT * FROM user_preferences WHERE id = 1",
      );
      if (!user) return null;

      return {
        weekly_reading_goal: user.weekly_reading_goal || 210,
        initial_reading_rate_minutes_per_day:
          user.initial_reading_rate_minutes_per_day || 30,
        end_reading_rate_goal_minutes_per_day:
          user.end_reading_rate_goal_minutes_per_day || 60,
        end_reading_rate_goal_date: user.end_reading_rate_goal_date || null,
        current_reading_rate_minutes_per_day:
          user.current_reading_rate_minutes_per_day || 30,
        current_reading_rate_last_updated:
          user.current_reading_rate_last_updated || null,
        // 0 is meaningful here (target == current): don't replace it with a default
        weekly_reading_rate_increase_minutes:
          user.weekly_reading_rate_increase_minutes ?? 0,
      };
    } catch (error) {
      console.error("❌ Error fetching user goal information:", error);
      return null;
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
