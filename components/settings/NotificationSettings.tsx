import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    AppState,
    Linking,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { NotificationPreferences } from "../../db/db";
import notificationService from "../../services/notificationService";
import { COLORS } from "../../themes/colors";

export default function NotificationSettings() {
  const { t } = useTranslation();
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSystemPermission, setHasSystemPermission] = useState(false);

  const openSystemSettings = useCallback(() => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  }, []);

  const showPermissionDeniedAlert = useCallback(() => {
    Alert.alert(
      t("settings.permissionRequired"),
      t("settings.notificationPermissionDenied"),
      [
        { text: t("settings.cancel"), style: "cancel" },
        {
          text: t("settings.openSettings"),
          style: "default",
          onPress: openSystemSettings,
        },
      ],
    );
  }, [openSystemSettings, t]);

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const prefs = await notificationService.getNotificationPreferences();
      console.log("🔔 Raw preferences from database:", prefs);

      if (prefs) {
        // Ensure boolean values are properly converted from SQLite integers
        const normalizedPrefs = {
          ...prefs,
          notifications_enabled: Boolean(prefs.notifications_enabled),
          daily_reminder_enabled: Boolean(prefs.daily_reminder_enabled),
        };
        console.log("🔔 Normalized preferences:", normalizedPrefs);
        setPreferences(normalizedPrefs);
      } else {
        console.log("⚠️ No preferences returned from service");
        setPreferences(null);
      }
    } catch (error) {
      console.error("❌ Error loading notification preferences:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkSystemPermissions = useCallback(async () => {
    try {
      const hasPermission = await notificationService.checkCurrentPermissions();
      setHasSystemPermission(hasPermission);

      // If system permissions changed, sync with database
      if (
        preferences &&
        !hasPermission &&
        (preferences.notifications_enabled || preferences.daily_reminder_enabled)
      ) {
        console.log("🔄 System permissions changed, syncing with database");
        await notificationService.syncPermissionsWithDatabase();
        await loadPreferences(); // Reload preferences to reflect changes
      }
    } catch (error) {
      console.error("❌ Error checking system permissions:", error);
    }
  }, [loadPreferences, preferences]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    checkSystemPermissions();

    // Listen for app state changes to detect when user returns from settings
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === "active") {
        // Add a small delay to ensure system settings have been processed
        setTimeout(() => {
          checkSystemPermissions();
        }, 500);
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, [checkSystemPermissions]);

  const updatePreferences = useCallback(async (
    updates: Partial<NotificationPreferences>,
  ) => {
    if (!preferences) return;

    console.log("🔄 Updating preferences:", JSON.stringify(updates, null, 2));
    console.log(
      "🔄 Current preferences before update:",
      JSON.stringify(preferences, null, 2),
    );

    try {
      setSaving(true);
      const success =
        await notificationService.updateNotificationPreferences(updates);
      console.log("✅ Update success:", success);

      if (success) {
        const updatedPrefs = { ...preferences, ...updates };
        console.log(
          "📱 Setting new preferences state:",
          JSON.stringify(updatedPrefs, null, 2),
        );
        setPreferences(updatedPrefs);
      } else {
        console.warn("⚠️ Update was not successful");
      }
    } catch (error) {
      console.error("❌ Error updating notification preferences:", error);
      Alert.alert(
        t("settings.error"),
        t("settings.failedToUpdateNotificationSettings"),
      );
    } finally {
      setSaving(false);
    }
  }, [preferences, t]);

  const handleReminderToggle = async (enabled: boolean) => {
    console.log("🔔 Reminder toggle changed to:", enabled);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (enabled) {
      // Check current system permissions first
      const currentSystemPermission =
        await notificationService.checkCurrentPermissions();

      if (!currentSystemPermission) {
        // Try to request permission
        console.log("🔐 Requesting notification permissions...");
        const hasPermission = await notificationService.requestPermissions();
        console.log("🔐 Permission granted:", hasPermission);

        if (!hasPermission) {
          console.warn("⚠️ Permission denied, showing settings alert");
          showPermissionDeniedAlert();
          return;
        }

        // Update system permission state
        setHasSystemPermission(true);
      }
    }

    console.log("📱 Updating reminder preferences to:", enabled);
    await updatePreferences({
      notifications_enabled: enabled,
      daily_reminder_enabled: enabled,
    });
  };

  const handleHourOptionPress = async (hours: number) => {
    if (!preferences) {
      return;
    }

    const remindersEnabled =
      preferences.notifications_enabled && preferences.daily_reminder_enabled;

    if (!remindersEnabled) {
      Alert.alert(t("settings.error"), t("settings.reminderSetupHintDisabled"));
      return;
    }

    if (!hasSystemPermission) {
      showPermissionDeniedAlert();
      return;
    }

    console.log("⏱️ Hour option changed to:", hours);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updatePreferences({
      daily_reminder_hours_after_last_open: hours,
    });
  };

  const handleTestNotification = async () => {
    try {
      const remindersEnabled =
        preferences?.notifications_enabled && preferences?.daily_reminder_enabled;

      if (!remindersEnabled) {
        Alert.alert(t("settings.error"), t("settings.reminderSetupHintDisabled"));
        return;
      }

      if (!hasSystemPermission) {
        showPermissionDeniedAlert();
        return;
      }

      await notificationService.scheduleDailyReminderNotification();
      Alert.alert(
        t("settings.testScheduled"),
        t("settings.testScheduledMessage", {
          hours: preferences?.daily_reminder_hours_after_last_open || 5,
        }),
      );
    } catch (error) {
      console.error("❌ Error sending test notification:", error);
      Alert.alert(
        t("settings.error"),
        t("settings.failedToSendTestNotification"),
      );
    }
  };

  if (loading || !preferences) {
    console.log(
      "🔄 Loading notification settings or preferences not available",
    );
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Ionicons name="notifications" size={32} color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t("settings.loadingNotificationSettings")}
          </Text>
        </View>
      </View>
    );
  }

  console.log("🎨 Rendering NotificationSettings with preferences:", {
    notifications_enabled: preferences.notifications_enabled,
    daily_reminder_enabled: preferences.daily_reminder_enabled,
    daily_reminder_hours_after_last_open:
      preferences.daily_reminder_hours_after_last_open,
    hasSystemPermission,
  });

  // Show system permission warning if needed
  const remindersEnabled =
    preferences.notifications_enabled && preferences.daily_reminder_enabled;
  const canConfigureReminders = remindersEnabled && hasSystemPermission;
  const reminderHours = preferences.daily_reminder_hours_after_last_open || 5;
  const showPermissionWarning = remindersEnabled && !hasSystemPermission;
  const reminderStatusText = !remindersEnabled
    ? t("settings.reminderSetupHintDisabled")
    : !hasSystemPermission
      ? t("settings.reminderSetupHintSystem")
      : t("settings.reminderTimingDescription", { hours: reminderHours });

  return (
    <View style={styles.container}>
      {/* System Permission Warning */}
      {showPermissionWarning && (
        <View style={styles.warningContainer}>
          <View style={styles.warningContent}>
            <Ionicons name="warning" size={20} color={COLORS.warning} />
            <Text style={styles.warningText}>
              {t("settings.notificationsDisabledInSystem")}
            </Text>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={openSystemSettings}
            >
              <Text style={styles.settingsButtonText}>
                {t("settings.openSettings")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Notifications Toggle */}
      <View style={styles.mainToggleContainer}>
        <View style={styles.toggleHeader}>
          <View
            style={[
              styles.iconContainer,
              showPermissionWarning && styles.iconContainerWarning,
            ]}
          >
            <Ionicons
              name={
                showPermissionWarning ? "notifications-off" : "notifications"
              }
              size={24}
              color={showPermissionWarning ? COLORS.warning : COLORS.primary}
            />
          </View>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>{t("settings.dailyReadingReminders")}</Text>
            <Text style={styles.toggleSubtitle}>
              {t("settings.dailyReadingRemindersDescription")}
            </Text>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={handleReminderToggle}
            trackColor={{
              false: COLORS.neutral[200],
              true: COLORS.state.primarySoft,
            }}
            thumbColor={
              remindersEnabled
                ? COLORS.primary
                : COLORS.neutral[400]
            }
            disabled={saving}
            style={styles.toggle}
          />
        </View>
      </View>

      <View style={styles.settingsContainer}>
        <View
          style={[
            styles.hourSettingContainer,
            !canConfigureReminders && styles.hourSettingContainerDisabled,
          ]}
        >
          <View style={styles.hourSettingHeader}>
            <Ionicons
              name="time-outline"
              size={20}
              color={COLORS.warning}
            />
            <Text style={styles.hourSettingTitle}>{t("settings.reminderTiming")}</Text>
          </View>

          <Text style={styles.hourSectionTitle}>
            {t("settings.hourSelectionDescription")}:
          </Text>

          <View style={styles.hourSectionContainer}>
            <View style={styles.hourGridContainer}>
              {[1, 3, 5, 8, 12, 24].map((hours) => (
                <TouchableOpacity
                  key={hours}
                  style={[
                    styles.hourOptionCard,
                    reminderHours === hours && styles.hourOptionCardSelected,
                    !canConfigureReminders && styles.hourOptionCardDisabled,
                  ]}
                  onPress={() => handleHourOptionPress(hours)}
                  disabled={saving || !canConfigureReminders}
                  activeOpacity={0.7}
                >
                  <View style={styles.hourOptionContent}>
                    <Text
                      style={[
                        styles.hourOptionNumber,
                        reminderHours === hours && styles.hourOptionNumberSelected,
                      ]}
                    >
                      {hours}
                    </Text>
                    <Text
                      style={[
                        styles.hourOptionLabel,
                        reminderHours === hours && styles.hourOptionLabelSelected,
                      ]}
                    >
                      {hours === 1
                        ? t("settings.hourSingular")
                        : t("settings.hourPlural")}
                    </Text>
                  </View>
                  {reminderHours === hours && (
                    <View style={styles.selectedIndicator}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={COLORS.primary}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text
            style={[
              styles.hourSettingDescription,
              !canConfigureReminders && styles.hourSettingDescriptionDisabled,
            ]}
          >
            {reminderStatusText}
          </Text>

          {!hasSystemPermission && remindersEnabled ? (
            <TouchableOpacity
              style={styles.inlineSettingsButton}
              onPress={openSystemSettings}
            >
              <Text style={styles.settingsButtonText}>
                {t("settings.openSettings")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Test Notification Button */}
        <TouchableOpacity
          style={[styles.testButton, !canConfigureReminders && styles.testButtonDisabled]}
          onPress={handleTestNotification}
          disabled={saving || !canConfigureReminders}
        >
          <Ionicons name="send" size={18} color={COLORS.white} />
          <Text style={styles.testButtonText}>{t("settings.sendTest")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  loadingContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingContent: {
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.neutral[500],
    marginTop: 12,
  },
  mainToggleContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[100],
  },
  toggleHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.state.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.neutral[800],
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 14,
    color: COLORS.neutral[500],
    lineHeight: 20,
  },
  toggle: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  dailyRemindersContainer: {
    backgroundColor: COLORS.neutral[50],
  },
  subToggleContainer: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
  },
  subToggleHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  subIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.state.successSoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  subToggleInfo: {
    flex: 1,
  },
  subToggleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 2,
  },
  subToggleSubtitle: {
    fontSize: 13,
    color: COLORS.neutral[500],
  },
  subToggle: {
    transform: [{ scaleX: 1.0 }, { scaleY: 1.0 }],
  },
  settingsContainer: {
    padding: 20,
    paddingTop: 16,
  },
  hourSettingContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  hourSettingContainerDisabled: {
    backgroundColor: COLORS.neutral[50],
  },
  hourSettingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  hourSettingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginLeft: 8,
  },
  hourSettingDescription: {
    fontSize: 14,
    marginTop: 12,
    color: COLORS.neutral[400],
    lineHeight: 20,
  },
  hourSettingDescriptionDisabled: {
    color: COLORS.neutral[500],
  },
  hourInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hourInputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.neutral[700],
    flex: 1,
  },
  hourInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  hourOptionsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  hourOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    backgroundColor: COLORS.white,
    minWidth: 60,
    alignItems: "center",
  },
  hourOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.state.primarySoft,
  },
  hourOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[500],
  },
  hourOptionTextSelected: {
    color: COLORS.primary,
  },
  // New improved hour selector styles
  hourSectionContainer: {
    marginTop: 16,
  },
  hourSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 4,
  },
  hourSectionSubtitle: {
    fontSize: 13,
    color: COLORS.neutral[500],
    marginBottom: 16,
    lineHeight: 18,
  },
  hourGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  hourOptionCard: {
    width: "30%",
    minWidth: 70,
    maxWidth: 90,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    padding: 10,
    alignItems: "center",
    position: "relative",
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  hourOptionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.state.primarySoftAlt,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  hourOptionCardDisabled: {
    opacity: 0.55,
  },
  hourOptionContent: {
    alignItems: "center",
    width: "100%",
  },
  hourOptionNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.neutral[700],
    marginBottom: 1,
  },
  hourOptionNumberSelected: {
    color: COLORS.primary,
  },
  hourOptionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.neutral[500],
  },
  hourOptionLabelSelected: {
    color: COLORS.primary,
  },
  selectedIndicator: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  inlineSettingsButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: COLORS.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  testButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  testButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    marginRight: 8,
  },
  // Warning styles
  warningContainer: {
    backgroundColor: COLORS.state.warningSoft,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  warningContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.state.warningText,
    marginLeft: 8,
    marginRight: 8,
  },
  settingsButton: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  settingsButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
  },
  iconContainerWarning: {
    backgroundColor: COLORS.state.warningSoft,
  },
});
