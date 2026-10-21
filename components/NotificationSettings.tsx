import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { NotificationPreferences } from "../db/db";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import { isDevModeEnabled } from "../utils/devMode";
import { getAppLocale } from "../utils/format";
import { log, warn } from "../utils/logger";

export default function NotificationSettings() {
  const { t } = useTranslation();
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSystemPermission, setHasSystemPermission] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const timeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedReminderTime = useRef<string | undefined>(undefined);

  useEffect(() => {
    loadPreferences();
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
  }, []);

  // Runs on mount and on every return to the app (e.g. from OS settings).
  // Revoked permission turns the reminder off in the DB; a newly granted one
  // is picked up when the user flips the switch on.
  const checkSystemPermissions = useCallback(async () => {
    try {
      const hasPermission = await NotificationService.checkCurrentPermissions();
      setHasSystemPermission(hasPermission);
      if (!hasPermission) {
        await NotificationService.syncPermissionsWithDatabase();
        await loadPreferences();
      }
    } catch (error) {
      console.error("❌ Error checking system permissions:", error);
    }
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await NotificationService.getNotificationPreferences();
      log("🔔 Raw preferences from database:", prefs);

      if (prefs) {
        // Ensure boolean values are properly converted from SQLite integers
        const normalizedPrefs = {
          ...prefs,
          notifications_enabled: Boolean(prefs.notifications_enabled),
          daily_reminder_enabled: Boolean(prefs.daily_reminder_enabled),
        };
        log("🔔 Normalized preferences:", normalizedPrefs);
        setPreferences(normalizedPrefs);
        savedReminderTime.current = normalizedPrefs.reminder_time;
      } else {
        log("⚠️ No preferences returned from service");
        setPreferences(null);
      }
    } catch (error) {
      console.error("❌ Error loading notification preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (
    updates: Partial<NotificationPreferences>,
  ) => {
    if (!preferences) return;

    log("🔄 Updating preferences:", JSON.stringify(updates, null, 2));
    log(
      "🔄 Current preferences before update:",
      JSON.stringify(preferences, null, 2),
    );

    try {
      setSaving(true);
      const success =
        await NotificationService.updateNotificationPreferences(updates);
      log("✅ Update success:", success);

      if (success) {
        const updatedPrefs = { ...preferences, ...updates };
        log(
          "📱 Setting new preferences state:",
          JSON.stringify(updatedPrefs, null, 2),
        );
        setPreferences(updatedPrefs);
      } else {
        warn("⚠️ Update was not successful");
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
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    log("🔔 Main notification toggle changed to:", enabled);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (enabled) {
      // Check current system permissions first
      const currentSystemPermission =
        await NotificationService.checkCurrentPermissions();

      if (!currentSystemPermission) {
        // Try to request permission
        log("🔐 Requesting notification permissions...");
        const hasPermission = await NotificationService.requestPermissions();
        log("🔐 Permission granted:", hasPermission);

        if (!hasPermission) {
          warn("⚠️ Permission denied, showing settings alert");
          Alert.alert(
            t("settings.permissionRequired"),
            t("settings.notificationPermissionDenied"),
            [
              { text: t("settings.cancel"), style: "cancel" },
              {
                text: t("settings.openSettings"),
                style: "default",
                onPress: () => {
                  if (Platform.OS === "ios") {
                    Linking.openURL("app-settings:");
                  } else {
                    Linking.openSettings();
                  }
                },
              },
            ],
          );
          return;
        }

        // Update system permission state
        setHasSystemPermission(true);
      }
    }

    log("📱 Updating reminder preference to:", enabled);
    // One switch for the one reminder: keep both legacy flags in step
    await updatePreferences({
      notifications_enabled: enabled,
      daily_reminder_enabled: enabled,
    });
  };

  const handleTestNotification = async () => {
    try {
      // Check current system permissions first
      const currentSystemPermission =
        await NotificationService.checkCurrentPermissions();

      if (!currentSystemPermission) {
        const hasPermission = await NotificationService.requestPermissions();
        if (!hasPermission) {
          Alert.alert(
            t("settings.permissionRequired"),
            t("settings.notificationPermissionDenied"),
            [
              { text: t("settings.cancel"), style: "cancel" },
              {
                text: t("settings.openSettings"),
                style: "default",
                onPress: () => {
                  if (Platform.OS === "ios") {
                    Linking.openURL("app-settings:");
                  } else {
                    Linking.openSettings();
                  }
                },
              },
            ],
          );
          return;
        }
      }

      // Check if in development mode for different behavior
      if (isDevModeEnabled()) {
        // In development, schedule a 1-minute test
        await NotificationService.scheduleTestNotification(1);
        Alert.alert(
          t("settings.devTestScheduled"),
          t("settings.devTestScheduledMessage"),
        );
      } else {
        // In production, use the normal scheduling
        await NotificationService.scheduleDailyReminderNotification();
        Alert.alert(
          t("settings.testScheduled"),
          t("settings.testScheduledMessage", {
            hours: preferences?.daily_reminder_hours_after_last_open || 5,
          }),
        );
      }
    } catch (error) {
      console.error("❌ Error sending test notification:", error);
      Alert.alert(
        t("settings.error"),
        t("settings.failedToSendTestNotification"),
      );
    }
  };

  if (loading || !preferences) {
    log("🔄 Loading notification settings or preferences not available");
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

  log("🎨 Rendering NotificationSettings with preferences:", {
    notifications_enabled: preferences.notifications_enabled,
    daily_reminder_enabled: preferences.daily_reminder_enabled,
    daily_reminder_hours_after_last_open:
      preferences.daily_reminder_hours_after_last_open,
    hasSystemPermission,
  });

  // Show system permission warning if needed
  const remindersOn =
    preferences.notifications_enabled &&
    preferences.daily_reminder_enabled &&
    hasSystemPermission;
  const reminderMode = preferences.reminder_mode ?? "after_close";
  const reminderTime = preferences.reminder_time ?? "20:00";
  const [reminderHours, reminderMinutes] = reminderTime.split(":").map(Number);
  const reminderTimeAsDate = new Date();
  reminderTimeAsDate.setHours(reminderHours || 0, reminderMinutes || 0, 0, 0);

  // Shown in the user's clock style ("8:00 PM" / "20:00"), stored as HH:MM
  const reminderTimeLabel = reminderTimeAsDate.toLocaleTimeString(
    getAppLocale(),
    { hour: "numeric", minute: "2-digit" },
  );

  const saveReminderTime = (date: Date) => {
    const time = `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes(),
    ).padStart(2, "0")}`;
    // The iOS compact picker reports every wheel tick: show the value right
    // away, but only write it once the wheel settles
    setPreferences((current) => current && { ...current, reminder_time: time });
    if (timeSaveTimer.current) clearTimeout(timeSaveTimer.current);
    timeSaveTimer.current = setTimeout(() => {
      if (time !== savedReminderTime.current) {
        savedReminderTime.current = time;
        NotificationService.updateNotificationPreferences({
          reminder_time: time,
        });
      }
    }, 600);
  };

  const showPermissionWarning =
    preferences.notifications_enabled && !hasSystemPermission;

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
              onPress={() => {
                if (Platform.OS === "ios") {
                  Linking.openURL("app-settings:");
                } else {
                  Linking.openSettings();
                }
              }}
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
            <Text style={styles.toggleTitle}>
              {t("settings.dailyReadingReminders")}
            </Text>
            <Text style={styles.toggleSubtitle}>
              {t("settings.dailyReadingRemindersDescription")}
            </Text>
          </View>
          <Switch
            value={remindersOn}
            onValueChange={handleNotificationToggle}
            trackColor={{
              false: COLORS.neutral[200],
              true: COLORS.state.primarySoft,
            }}
            thumbColor={remindersOn ? COLORS.primary : COLORS.neutral[400]}
            disabled={saving}
            style={styles.toggle}
          />
        </View>
      </View>

      {/* Reminder timing - only when the reminder is on */}
      {remindersOn && (
        <View style={styles.dailyRemindersContainer}>
          <View style={styles.modeRow}>
            {(["after_close", "daily_time"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.modeChip,
                  reminderMode === mode && styles.modeChipSelected,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updatePreferences({ reminder_mode: mode });
                }}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ selected: reminderMode === mode }}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    reminderMode === mode && styles.modeChipTextSelected,
                  ]}
                >
                  {mode === "after_close"
                    ? t("settings.reminderModeAfterClose")
                    : t("settings.reminderModeAtTime")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {reminderMode === "daily_time" && (
            <View style={styles.hourSettingContainer}>
              <View style={styles.hourSettingHeader}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={COLORS.warning}
                />
                <Text style={styles.hourSettingTitle}>
                  {t("settings.reminderTimeLabel")}
                </Text>
              </View>
              {Platform.OS === "ios" ? (
                <DateTimePicker
                  value={reminderTimeAsDate}
                  mode="time"
                  display="compact"
                  onChange={(_, date) => date && saveReminderTime(date)}
                  style={styles.timePicker}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={styles.timeButtonText}>
                      {reminderTimeLabel}
                    </Text>
                  </TouchableOpacity>
                  {showTimePicker && (
                    <DateTimePicker
                      value={reminderTimeAsDate}
                      mode="time"
                      onChange={(event, date) => {
                        setShowTimePicker(false);
                        if (date && event.type !== "dismissed") {
                          saveReminderTime(date);
                        }
                      }}
                    />
                  )}
                </>
              )}
              <Text style={styles.hourSettingDescription}>
                {t("settings.reminderAtTimeDescription", {
                  time: reminderTimeLabel,
                })}
              </Text>
            </View>
          )}

          {reminderMode === "after_close" && (
            <View style={styles.settingsContainer}>
              <View style={styles.hourSettingContainer}>
                <View style={styles.hourSettingHeader}>
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={COLORS.warning}
                  />
                  <Text style={styles.hourSettingTitle}>
                    {t("settings.reminderTiming")}
                  </Text>
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
                          preferences.daily_reminder_hours_after_last_open ===
                            hours && styles.hourOptionCardSelected,
                        ]}
                        onPress={() => {
                          log("⏱️ Hour option changed to:", hours);
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          updatePreferences({
                            daily_reminder_hours_after_last_open: hours,
                          });
                        }}
                        disabled={saving}
                        activeOpacity={0.7}
                      >
                        <View style={styles.hourOptionContent}>
                          <Text
                            style={[
                              styles.hourOptionNumber,
                              preferences.daily_reminder_hours_after_last_open ===
                                hours && styles.hourOptionNumberSelected,
                            ]}
                          >
                            {hours}
                          </Text>
                          <Text
                            style={[
                              styles.hourOptionLabel,
                              preferences.daily_reminder_hours_after_last_open ===
                                hours && styles.hourOptionLabelSelected,
                            ]}
                          >
                            {hours === 1
                              ? t("settings.hourSingular")
                              : t("settings.hourPlural")}
                          </Text>
                        </View>
                        {preferences.daily_reminder_hours_after_last_open ===
                          hours && (
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
                <Text style={styles.hourSettingDescription}>
                  {t("settings.reminderTimingDescription", {
                    hours: preferences.daily_reminder_hours_after_last_open,
                  })}
                </Text>
              </View>

              {/* Test Notification Button */}
              {isDevModeEnabled() && (
                <TouchableOpacity
                  style={styles.testButton}
                  onPress={handleTestNotification}
                  disabled={saving}
                >
                  <Ionicons name="send" size={18} color={COLORS.white} />
                  <Text style={styles.testButtonText}>
                    {isDevModeEnabled()
                      ? t("settings.sendTestDev")
                      : t("settings.sendTest")}
                  </Text>
                  {isDevModeEnabled() && (
                    <Text style={styles.devBadge}>DEV</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    backgroundColor: COLORS.white,
    alignItems: "center",
  },
  modeChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.neutral[500],
    textAlign: "center",
  },
  modeChipTextSelected: {
    color: COLORS.white,
  },
  timePicker: {
    alignSelf: "flex-start",
    marginVertical: 8,
  },
  timeButton: {
    alignSelf: "flex-start",
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  timeButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
  },
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
  testButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    marginRight: 8,
  },
  devBadge: {
    backgroundColor: COLORS.state.dangerStrong,
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
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
