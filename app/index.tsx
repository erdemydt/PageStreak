import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { initializeDatabase } from "../db/db";
import { getUserPreferences } from "../db/repos/preferences";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import { backfillGoalHistoryIfEmpty } from "../utils/goalHistory";
import { applyWeeklyGoalGrowth } from "../utils/goalSettings";
import { log } from "../utils/logger";

export default function Index() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [initFailed, setInitFailed] = useState(false);

  useEffect(() => {
    initializeAppDatabase();
  }, []);

  const initializeAppDatabase = async () => {
    try {
      log("🔄 Starting app database initialization...");

      // Schema migrations run first; nothing may touch the DB before this
      await initializeDatabase();
      log("✅ Database ready");

      try {
        await NotificationService.reset();
        // Record this app open now that the tables are guaranteed to exist
        // (root layout only forwards later app-state changes)
        await NotificationService.onAppStateChange("active");

        // Make sure the preferences row exists (never prompts)
        const notificationPrefs =
          await NotificationService.getNotificationPreferences();
        log("🔔 Notification preferences initialized:", {
          enabled: notificationPrefs?.notifications_enabled,
          reminders: notificationPrefs?.daily_reminder_enabled,
          hours: notificationPrefs?.daily_reminder_hours_after_last_open,
        });

        // Sync system permissions with database preferences
        await NotificationService.syncPermissionsWithDatabase();

        log("✅ Notification service initialized and permissions synced");
      } catch (notificationError) {
        console.error(
          "⚠️ Notification service initialization failed, continuing without notifications:",
          notificationError,
        );
      }

      // Never let goal bookkeeping block startup or send an onboarded user
      // back to intro; streaks fall back to the current goal without history
      try {
        await backfillGoalHistoryIfEmpty();
      } catch (error) {
        console.error("❌ Failed to backfill goal history:", error);
      }

      // Grow the daily goal before navigating, so the home screen shows the
      // up-to-date goal on first render
      await applyWeeklyGoalGrowth();

      // Then check user setup and handle navigation
      await checkUserSetup();
    } catch (error) {
      console.error("❌ Failed to initialize app database:", error);
      // Never fall back to onboarding here: finishing it would overwrite an
      // existing user's profile. Offer a retry instead.
      setInitFailed(true);
      setIsLoading(false);
    }
  };

  const checkUserSetup = async () => {
    try {
      const user = await getUserPreferences();

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

  if (initFailed) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>{t("navigation.startupError")}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setInitFailed(false);
            setIsLoading(true);
            initializeAppDatabase();
          }}
        >
          <Text style={styles.retryButtonText}>{t("navigation.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      <Text style={styles.loadingText}>{t("navigation.loading")}</Text>
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
  errorTitle: {
    fontSize: 16,
    color: COLORS.neutral[800],
    textAlign: "center",
    marginHorizontal: 32,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.neutral[800],
  },
});
