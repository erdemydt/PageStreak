import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { NotificationPreferences } from "../../db/db";
import NotificationService from "../../services/notificationService";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { TYPE } from "../../themes/typography";
import { getAppLocale } from "../../utils/format";
import Chip from "../ui/Chip";
import SettingsRow from "./SettingsRow";

const HOUR_OPTIONS = [1, 3, 5, 8, 12, 24];

const openSystemSettings = () => {
  if (Platform.OS === "ios") {
    Linking.openURL("app-settings:");
  } else {
    Linking.openSettings();
  }
};

/**
 * The one daily reminder: on/off, then either "N hours after I leave the app"
 * or "at a set time". Permission is asked only when the switch is turned on.
 */
export default function ReminderSettings() {
  const { t } = useTranslation();
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasSystemPermission, setHasSystemPermission] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const timeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedReminderTime = useRef<string | undefined>(undefined);

  const loadPreferences = async () => {
    try {
      const prefs = await NotificationService.getNotificationPreferences();
      if (prefs) {
        // SQLite stores booleans as 0/1
        setPreferences({
          ...prefs,
          notifications_enabled: Boolean(prefs.notifications_enabled),
          daily_reminder_enabled: Boolean(prefs.daily_reminder_enabled),
        });
        savedReminderTime.current = prefs.reminder_time;
      } else {
        setPreferences(null);
      }
    } catch (error) {
      console.error("Error loading notification preferences:", error);
    }
  };

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
      console.error("Error checking notification permissions:", error);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
    checkSystemPermissions();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // Give the system a moment to apply a change made in OS settings
        setTimeout(checkSystemPermissions, 500);
      }
    });
    return () => subscription.remove();
  }, [checkSystemPermissions]);

  const updatePreferences = async (
    updates: Partial<NotificationPreferences>,
  ) => {
    if (!preferences) return;
    try {
      setSaving(true);
      const success =
        await NotificationService.updateNotificationPreferences(updates);
      if (success) {
        setPreferences({ ...preferences, ...updates });
      }
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      Alert.alert(
        t("settings.error"),
        t("settings.failedToUpdateNotificationSettings"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (enabled && !(await NotificationService.checkCurrentPermissions())) {
      const granted = await NotificationService.requestPermissions();
      if (!granted) {
        Alert.alert(
          t("settings.permissionRequired"),
          t("settings.notificationPermissionDenied"),
          [
            { text: t("settings.cancel"), style: "cancel" },
            { text: t("settings.openSettings"), onPress: openSystemSettings },
          ],
        );
        return;
      }
      setHasSystemPermission(true);
    }

    // One switch for the one reminder: keep both legacy flags in step
    await updatePreferences({
      notifications_enabled: enabled,
      daily_reminder_enabled: enabled,
    });
  };

  if (!preferences) {
    // Keeps the section's height steady while the row loads
    return <View style={styles.placeholder} />;
  }

  const remindersOn =
    preferences.notifications_enabled &&
    preferences.daily_reminder_enabled &&
    hasSystemPermission;
  const showPermissionWarning =
    preferences.notifications_enabled && !hasSystemPermission;
  const reminderMode = preferences.reminder_mode ?? "after_close";
  const hoursAfter = preferences.daily_reminder_hours_after_last_open;

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
        }).catch((error) =>
          console.error("Error saving the reminder time:", error),
        );
      }
    }, 600);
  };

  const timeControls = (
    <>
      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>
          {t("settings.reminderTimeLabel")}
        </Text>
        {Platform.OS === "ios" ? (
          <DateTimePicker
            value={reminderTimeAsDate}
            mode="time"
            display="compact"
            accentColor={COLORS.accent.primary}
            onChange={(_, date) => date && saveReminderTime(date)}
          />
        ) : (
          <Pressable
            onPress={() => setShowTimePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t("settings.reminderTimeLabel")}, ${reminderTimeLabel}`}
            hitSlop={8}
          >
            <Text style={styles.timeValue}>{reminderTimeLabel}</Text>
          </Pressable>
        )}
      </View>
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
      <Text style={styles.description}>
        {t("settings.reminderAtTimeDescription", {
          time: reminderTimeLabel,
        })}
      </Text>
    </>
  );

  const hourControls = (
    <>
      <View style={styles.chips}>
        {HOUR_OPTIONS.map((hours) => (
          <Chip
            key={hours}
            grow
            label={t("duration.hours", { count: hours })}
            selected={hoursAfter === hours}
            disabled={saving}
            onPress={() => {
              if (hoursAfter === hours) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              updatePreferences({
                daily_reminder_hours_after_last_open: hours,
              });
            }}
            style={styles.hourChip}
          />
        ))}
      </View>
      <Text style={styles.description}>
        {hoursAfter === 1
          ? t("settings.reminderTimingDescriptionOne")
          : t("settings.reminderTimingDescription", { hours: hoursAfter })}
      </Text>
    </>
  );

  return (
    <View>
      <SettingsRow
        first
        label={t("settings.dailyReminder")}
        hint={t("settings.dailyReadingRemindersDescription")}
        trailing={
          <Switch
            value={remindersOn}
            onValueChange={handleToggle}
            disabled={saving}
            trackColor={{ false: COLORS.line.strong, true: COLORS.accent.primary }}
            ios_backgroundColor={COLORS.line.strong}
            accessibilityLabel={t("settings.dailyReminder")}
            accessibilityHint={t("settings.dailyReadingRemindersDescription")}
          />
        }
      />

      {showPermissionWarning && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            {t("settings.notificationsDisabledInSystem")}
          </Text>
          <Pressable
            onPress={openSystemSettings}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text style={styles.link}>{t("settings.openSettings")}</Text>
          </Pressable>
        </View>
      )}

      {remindersOn &&
        (["after_close", "daily_time"] as const).map((mode) => (
          <View key={mode}>
            <SettingsRow
              label={
                mode === "after_close"
                  ? t("settings.reminderModeAfterClose")
                  : t("settings.reminderModeAtTime")
              }
              selected={reminderMode === mode}
              disabled={saving}
              onPress={() => {
                if (reminderMode === mode) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                updatePreferences({ reminder_mode: mode });
              }}
            />
            {/* Each mode's controls sit under its own row, only while selected */}
            {reminderMode === mode && (
              <View style={styles.timing}>
                {mode === "daily_time" ? timeControls : hourControls}
              </View>
            )}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    minHeight: 72,
  },
  warning: {
    gap: SPACING[1],
    paddingBottom: SPACING[3],
  },
  warningText: {
    ...TYPE.meta,
    color: COLORS.destructive.ink,
  },
  link: {
    ...TYPE.label,
    color: COLORS.accent.primary,
  },
  timing: {
    gap: SPACING[3],
    paddingBottom: SPACING[3],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING[2],
  },
  // Three to a row
  hourChip: {
    flexBasis: "30%",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    gap: SPACING[3],
  },
  timeLabel: TYPE.label,
  timeValue: {
    ...TYPE.label,
    color: COLORS.accent.primary,
  },
  description: TYPE.meta,
});
