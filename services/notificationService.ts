import * as Notifications from 'expo-notifications';
import { getLastOpenedTime, trackAppClosed, trackAppOpened } from '../db/repos/appUsage';
import {
  areRemindersEnabled,
  ensureNotificationPreferences,
  readNotificationPreferences,
  writeNotificationPreferences,
} from '../db/repos/notificationPrefs';
import { getUserPreferences } from '../db/repos/preferences';
import type { NotificationPreferences } from '../types/models';
import { log } from '../utils/logger';
import {
  getNotificationStatus,
  isNotificationDevMode,
  scheduleReminderNow,
  scheduleTestNotification,
  sendImmediateTestNotification,
} from './notificationDevTools';
import {
  cancelReminders,
  ensureAndroidChannel,
  isDailyGoalMet,
  scheduleAfterLastOpen,
  scheduleAtDailyTime,
} from './reminderScheduler';

/**
 * The app's one entry point for reminders: permissions, preferences and the
 * app-state lifecycle. Scheduling lives in reminderScheduler, storage in
 * db/repos/{notificationPrefs,appUsage}, test tools in notificationDevTools.
 *
 * Lifecycle: opening the app cancels the reminder; going to 'background'
 * (never 'inactive', which iOS reports for Control Center, Face ID, system
 * alerts...) reschedules it unless today's goal is met.
 */

// Configure how notifications appear while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Serializes app-state handling so overlapping transitions can't interleave
// cancel/schedule calls
let appStateQueue: Promise<void> = Promise.resolve();

async function checkCurrentPermissions(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('❌ Error checking notification permissions:', error);
    return false;
  }
}

/** Shows the system prompt if not yet decided. Only call from a user action. */
async function requestPermissions(): Promise<boolean> {
  try {
    await ensureAndroidChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('❌ Error requesting notification permissions:', error);
    return false;
  }
}

async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  try {
    return await ensureNotificationPreferences();
  } catch (error) {
    console.error('❌ Error getting notification preferences:', error);
    return null;
  }
}

async function updateNotificationPreferences(
  updates: Partial<NotificationPreferences>
): Promise<boolean> {
  try {
    await writeNotificationPreferences(updates);
    if (updates.notifications_enabled === false || updates.daily_reminder_enabled === false) {
      await cancelReminders();
    }
    return true;
  } catch (error) {
    console.error('❌ Error updating notification preferences:', error);
    return false;
  }
}

/** Turn the reminder off in the DB when the OS permission is missing */
async function syncPermissionsWithDatabase(): Promise<void> {
  try {
    if (await checkCurrentPermissions()) return;
    const prefs = await readNotificationPreferences();
    if (prefs && (prefs.notifications_enabled || prefs.daily_reminder_enabled)) {
      log('🔄 System permissions denied, updating database to reflect this');
      await updateNotificationPreferences({
        notifications_enabled: false,
        daily_reminder_enabled: false,
      });
    }
  } catch (error) {
    console.error('❌ Error syncing permissions with database:', error);
  }
}

/**
 * Schedule (or cancel) the reminder for the current state. Safe to call any
 * time; it replaces whatever was scheduled. Never prompts for permission.
 */
async function checkAndScheduleNotification(): Promise<void> {
  try {
    if (!(await getUserPreferences())) return; // not onboarded

    // In the early-return cases, drop a reminder scheduled earlier (e.g. by
    // a previous log that didn't reach the goal yet)
    if (!(await areRemindersEnabled()) || !(await checkCurrentPermissions())) {
      await cancelReminders();
      return;
    }

    const prefs = await readNotificationPreferences();
    if (!prefs) return;
    const goalMet = await isDailyGoalMet();

    await cancelReminders();
    if (prefs.reminder_mode === 'daily_time') {
      await scheduleAtDailyTime(prefs.reminder_time ?? '20:00', goalMet);
    } else if (!goalMet) {
      await scheduleAfterLastOpen(
        prefs.daily_reminder_hours_after_last_open,
        await getLastOpenedTime(),
        isNotificationDevMode()
      );
    }
  } catch (error) {
    console.error('❌ Error in checkAndScheduleNotification:', error);
  }
}

async function handleAppStateChange(nextAppState: string): Promise<void> {
  try {
    // Tracking is bookkeeping: a failed write must never skip the cancel or
    // reschedule that follows it
    if (nextAppState === 'active') {
      await trackAppOpened().catch((e) => console.error('❌ Error tracking app opened:', e));
      await cancelReminders();
    } else if (nextAppState === 'background') {
      await trackAppClosed().catch((e) => console.error('❌ Error tracking app closed:', e));
      await checkAndScheduleNotification();
    }
  } catch (error) {
    console.error('❌ Error handling app state change:', error);
  }
}

function onAppStateChange(nextAppState: string): Promise<void> {
  appStateQueue = appStateQueue.then(() => handleAppStateChange(nextAppState));
  return appStateQueue;
}

/** Cancel everything, including reminders older app versions scheduled under random ids */
async function cleanup(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('❌ Error during notification cleanup:', error);
  }
}

/** App start (after migrations): clear stale schedules, ensure channel and prefs row */
async function reset(): Promise<void> {
  await cleanup();
  await ensureAndroidChannel();
  await getNotificationPreferences();
}

const NotificationService = {
  requestPermissions,
  checkCurrentPermissions,
  syncPermissionsWithDatabase,
  getNotificationPreferences,
  updateNotificationPreferences,
  checkAndScheduleNotification,
  cancelScheduledNotification: cancelReminders,
  onAppStateChange,
  cleanup,
  reset,
  // Dev tools
  scheduleDailyReminderNotification: scheduleReminderNow,
  scheduleTestNotification,
  sendImmediateTestNotification,
  getNotificationStatus,
};

export default NotificationService;
