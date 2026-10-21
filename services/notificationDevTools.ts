import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { getLastOpenedTime } from '../db/repos/appUsage';
import {
  areRemindersEnabled,
  readNotificationPreferences,
} from '../db/repos/notificationPrefs';
import type { NotificationPreferences } from '../types/models';
import { isDevModeEnabled } from '../utils/devMode';
import { cancelReminders, scheduleAfterLastOpen } from './reminderScheduler';

/**
 * Test tools for notifications: NotificationTester (dev mode only) and the
 * Settings "Send test" button (scheduleReminderNow).
 */

export const isNotificationDevMode = (): boolean =>
  isDevModeEnabled() || Constants.expoConfig?.extra?.isDevelopment === true;

async function hasPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Test buttons are explicit user actions, so asking is fine here */
async function ensurePermission(): Promise<boolean> {
  if (await hasPermission()) return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Schedule the regular reminder now (one minute in dev mode) */
export async function scheduleReminderNow(): Promise<void> {
  try {
    if (!(await areRemindersEnabled()) || !(await hasPermission())) return;
    const prefs = await readNotificationPreferences();
    if (!prefs) return;
    await cancelReminders();
    await scheduleAfterLastOpen(prefs.daily_reminder_hours_after_last_open, null, isNotificationDevMode());
  } catch (error) {
    console.error('❌ Error scheduling daily reminder notification:', error);
  }
}

export async function scheduleTestNotification(minutes: number = 1): Promise<void> {
  if (!isNotificationDevMode()) return;
  try {
    if (!(await ensurePermission())) return;
    await cancelReminders();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Test Notification',
        body: `This is a test notification scheduled ${minutes} minute(s) ago when the app was last opened.`,
        sound: 'default',
        data: { type: 'test_notification', minutesAfterOpen: minutes, isDevelopment: true },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60 },
    });
  } catch (error) {
    console.error('❌ Error scheduling test notification:', error);
  }
}

export async function sendImmediateTestNotification(): Promise<void> {
  if (!isNotificationDevMode()) return;
  try {
    if (!(await ensurePermission())) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Immediate Test Notification',
        body: 'This is an immediate test notification to verify the notification system is working.',
        sound: 'default',
        data: { type: 'immediate_test', isDevelopment: true },
      },
      trigger: null,
    });
  } catch (error) {
    console.error('❌ Error sending immediate test notification:', error);
  }
}

export async function getNotificationStatus(): Promise<{
  enabled: boolean;
  hasPermission: boolean;
  isDevelopment: boolean;
  lastOpenedTime: Date | null;
  scheduledNotifications: number;
  preferences: NotificationPreferences | null;
}> {
  try {
    const [enabled, permission, lastOpened, scheduled, prefs] = await Promise.all([
      areRemindersEnabled(),
      hasPermission(),
      getLastOpenedTime(),
      Notifications.getAllScheduledNotificationsAsync(),
      readNotificationPreferences(),
    ]);
    return {
      enabled,
      hasPermission: permission,
      isDevelopment: isNotificationDevMode(),
      lastOpenedTime: lastOpened,
      scheduledNotifications: scheduled.length,
      preferences: prefs,
    };
  } catch (error) {
    console.error('❌ Error getting notification status:', error);
    return {
      enabled: false,
      hasPermission: false,
      isDevelopment: isNotificationDevMode(),
      lastOpenedTime: null,
      scheduledNotifications: 0,
      preferences: null,
    };
  }
}
