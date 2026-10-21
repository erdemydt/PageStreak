import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDailyGoal } from '../db/repos/preferences';
import i18n from '../i18n';
import { dateToLocalDateString, getTodayDateString } from '../utils/dateUtils';
import { formatDuration } from '../utils/format';
import { log } from '../utils/logger';
import { getReadingStreak, getTodayReadingMinutes } from '../utils/readingProgress';

/**
 * Stateless reminder scheduling. Every function reads what it needs and
 * replaces whatever was scheduled before (fixed identifiers), so nothing is
 * kept in memory between app launches.
 */

// The daily reminder always uses this identifier, so scheduling a new one
// replaces the old one and cancelling never touches other notifications
export const REMINDER_ID = 'daily-reminder';
export const ANDROID_CHANNEL_ID = 'default';
// How many days of "set time" reminders are queued ahead
export const DAILY_TIME_DAYS = 7;

// "After I leave the app" reminders never fire during quiet hours; they're
// pushed to QUIET_HOURS_END instead
const QUIET_HOURS_START = 22;
const QUIET_HOURS_END = 9;

/**
 * Moves a trigger time that falls in quiet hours to the next QUIET_HOURS_END
 */
export const adjustForQuietHours = (triggerTime: Date): Date => {
  const hour = triggerTime.getHours();
  if (hour >= QUIET_HOURS_END && hour < QUIET_HOURS_START) {
    return triggerTime;
  }
  const adjusted = new Date(triggerTime);
  if (hour >= QUIET_HOURS_START) {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  adjusted.setHours(QUIET_HOURS_END, 0, 0, 0);
  return adjusted;
};

/**
 * Create/update the Android notification channel (no-op elsewhere).
 * Safe to call repeatedly; it also refreshes the localized channel name.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: i18n.t('settings.dailyReadingReminders'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  } catch (error) {
    console.error('❌ Error creating Android notification channel:', error);
  }
}

/** Cancel the reminder and the queued "set time" days */
export async function cancelReminders(): Promise<void> {
  try {
    await Promise.all(
      Array.from({ length: DAILY_TIME_DAYS }, (_, day) =>
        Notifications.cancelScheduledNotificationAsync(
          day === 0 ? REMINDER_ID : `${REMINDER_ID}-${day}`
        )
      )
    );
  } catch (error) {
    console.error('❌ Error cancelling notification:', error);
  }
}

export async function getRemainingTimeToGoal(): Promise<{
  remainingMinutes: number;
  dailyGoal: number;
  minutesRead: number;
}> {
  const dailyGoal = await getDailyGoal();
  const minutesRead = await getTodayReadingMinutes();
  return {
    remainingMinutes: Math.max(0, dailyGoal - minutesRead),
    dailyGoal,
    minutesRead,
  };
}

/** On a read error, treat the goal as not met (a reminder beats a silent miss) */
export async function isDailyGoalMet(): Promise<boolean> {
  try {
    const { remainingMinutes } = await getRemainingTimeToGoal();
    return remainingMinutes === 0;
  } catch (error) {
    console.error('❌ Error checking daily goal:', error);
    return false;
  }
}

/**
 * Localized reminder text with the time left to today's goal. When the
 * reminder fires on a later day (quiet hours, or a queued "set time" day),
 * that day's goal is untouched, so the full goal is what remains.
 */
export async function generateReminderMessage(firesToday: boolean = true): Promise<string> {
  const key = 'settings.notificationMessages';
  const baseMessage = i18n.t(`${key}.defaultMessage`);
  try {
    const goal = await getRemainingTimeToGoal();
    const remainingMinutes = firesToday ? goal.remainingMinutes : goal.dailyGoal;
    if (remainingMinutes === 0) {
      return i18n.t(`${key}.goalCompleted`);
    }
    // A live streak is the strongest nudge: name it when today can still keep it
    const streak = firesToday ? await getReadingStreak() : 0;
    if (streak > 0) {
      return i18n.t(`${key}.streakAtRisk`, {
        remainingTime: formatDuration(remainingMinutes, 'long'),
        streak,
      });
    }
    return i18n.t(`${key}.goalRemaining`, {
      baseMessage,
      remainingTime: formatDuration(remainingMinutes, 'long'),
      dailyGoal: goal.dailyGoal,
    });
  } catch (error) {
    console.error('❌ Error generating notification message:', error);
    return baseMessage;
  }
}

async function scheduleReminder(
  trigger: Notifications.NotificationTriggerInput,
  firesToday: boolean,
  data: Record<string, unknown>,
  identifier: string = REMINDER_ID
): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: i18n.t('settings.notificationMessages.defaultTitle'),
      body: await generateReminderMessage(firesToday),
      sound: 'default',
      data,
    },
    trigger,
  });
}

/**
 * "After I leave the app" mode: `hoursAfter` hours after the last app open,
 * moved out of quiet hours. With `devQuick`, fires in one minute instead.
 */
export async function scheduleAfterLastOpen(
  hoursAfter: number,
  lastOpened: Date | null,
  devQuick: boolean
): Promise<void> {
  let triggerTime: Date;
  if (devQuick) {
    triggerTime = new Date(Date.now() + 60 * 1000);
    log('🔧 [DEV MODE] Scheduling notification in 1 minute for testing');
  } else {
    const hoursSinceOpen = lastOpened
      ? (Date.now() - lastOpened.getTime()) / (1000 * 60 * 60)
      : 0;
    triggerTime =
      hoursSinceOpen >= hoursAfter
        ? new Date(Date.now() + 60 * 1000) // overdue: soon
        : new Date(Date.now() + (hoursAfter - hoursSinceOpen) * 3600 * 1000);
    triggerTime = adjustForQuietHours(triggerTime);
  }

  const seconds = Math.max(60, Math.round((triggerTime.getTime() - Date.now()) / 1000));
  await scheduleReminder(
    { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: ANDROID_CHANNEL_ID },
    dateToLocalDateString(triggerTime) === getTodayDateString(),
    { type: 'daily_reminder_based_on_last_open', lastOpenedAt: lastOpened?.toISOString() ?? null }
  );
  log(`✅ Scheduled reminder for ${triggerTime.toLocaleString()}`);
}

/**
 * "At a set time" mode: remind at HH:MM today if today's goal isn't met
 * yet, otherwise from tomorrow. Queues the next DAILY_TIME_DAYS days so it
 * repeats without the app being opened (each later day's goal is untouched).
 * Opening the app cancels them and leaving it reschedules, so a met goal
 * still suppresses today's. The user picked the time: no quiet hours.
 */
export async function scheduleAtDailyTime(time: string, isGoalMetToday: boolean): Promise<void> {
  const [hours, minutes] = time.split(':').map(Number);
  const first = new Date();
  first.setHours(hours || 0, minutes || 0, 0, 0);
  if (isGoalMetToday || first.getTime() <= Date.now()) {
    // Today is done or its slot has passed: start tomorrow
    first.setDate(first.getDate() + 1);
  } else if (first.getTime() - Date.now() < 60 * 1000) {
    // The slot is moments away: still remind today, just a minute later
    first.setTime(Date.now() + 60 * 1000);
  }

  for (let day = 0; day < DAILY_TIME_DAYS; day++) {
    const trigger = new Date(first);
    if (day > 0) {
      trigger.setDate(first.getDate() + day);
      trigger.setHours(hours || 0, minutes || 0, 0, 0);
    }
    await scheduleReminder(
      { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger, channelId: ANDROID_CHANNEL_ID },
      dateToLocalDateString(trigger) === getTodayDateString(),
      { type: 'daily_reminder_at_time', scheduledFor: trigger.toISOString() },
      day === 0 ? REMINDER_ID : `${REMINDER_ID}-${day}`
    );
  }
  log(`✅ Scheduled ${DAILY_TIME_DAYS} daily-time reminders from ${first.toLocaleString()}`);
}
