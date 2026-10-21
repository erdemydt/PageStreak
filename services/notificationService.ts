import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppUsageTracking, execute, NotificationPreferences, queryFirst } from '../db/db';
import i18n from '../i18n';
import { getDailyGoal } from '../db/repos/preferences';
import { formatDuration } from '../utils/format';
import { getTodayReadingMinutes } from '../utils/readingProgress';
import { dateToLocalDateString, getTodayDateString } from '../utils/dateUtils';
import { isDevModeEnabled } from '../utils/devMode';
import { log } from '../utils/logger';

// The daily reminder always uses this identifier, so scheduling a new one
// replaces the old one and cancelling never touches other notifications
const REMINDER_ID = 'daily-reminder';
const ANDROID_CHANNEL_ID = 'default';
// How many days of "set time" reminders are queued ahead
const DAILY_TIME_DAYS = 7;

// Reminders never fire during quiet hours; they're pushed to QUIET_HOURS_END instead
const QUIET_HOURS_START = 22;
const QUIET_HOURS_END = 9;

/**
 * Moves a trigger time that falls in quiet hours to the next QUIET_HOURS_END
 */
const adjustForQuietHours = (triggerTime: Date): Date => {
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

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  // Serializes app-state handling so overlapping transitions can't interleave
  // cancel/schedule calls
  private appStateQueue: Promise<void> = Promise.resolve();

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Check if we're in development mode
   */
  private isDevelopment(): boolean {
    return isDevModeEnabled() || Constants.expoConfig?.extra?.isDevelopment === true;
  }

  /**
   * Check if a user is logged in by verifying user_preferences table
   */
  private async isUserLoggedIn(): Promise<boolean> {
    try {
      const user = await queryFirst('SELECT id FROM user_preferences WHERE id = 1');
      return !!user;
    } catch (error) {
      console.error('❌ Error checking user login status:', error);
      return false;
    }
  }

  /**
   * Request notification permissions from the user
   */
  /**
   * Create/update the Android notification channel (no-op elsewhere).
   * Safe to call repeatedly; it also refreshes the localized channel name.
   */
  async ensureAndroidChannel(): Promise<void> {
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

  async requestPermissions(): Promise<boolean> {
    try {
      await this.ensureAndroidChannel();

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Check current system notification permissions without requesting
   */
  async checkCurrentPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('❌ Error checking notification permissions:', error);
      return false;
    }
  }

  /**
   * Sync system permissions with database preferences
   * If system permissions are denied, update database to reflect this
   */
  async syncPermissionsWithDatabase(): Promise<void> {
    try {
      const hasSystemPermission = await this.checkCurrentPermissions();
      const prefs = await this.getNotificationPreferences();
      
      if (!prefs) {
        log('📝 No preferences found, creating defaults');
        return;
      }

      log('🔄 Syncing permissions:', {
        hasSystemPermission,
        dbNotificationsEnabled: prefs.notifications_enabled,
        dbDailyReminderEnabled: prefs.daily_reminder_enabled
      });

      // If system permissions are denied but database shows enabled, update database
      if (!hasSystemPermission && (prefs.notifications_enabled || prefs.daily_reminder_enabled)) {
        log('🔄 System permissions denied, updating database to reflect this');
        await this.updateNotificationPreferences({
          notifications_enabled: false,
          daily_reminder_enabled: false
        });
        
        // Cancel any scheduled notifications
        await this.cancelScheduledNotification();
      }
    } catch (error) {
      console.error('❌ Error syncing permissions with database:', error);
    }
  }

  /**
   * Check if notifications are enabled in user preferences
   */
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      // Read-only on purpose: getNotificationPreferences() creates a missing
      // row, which requests permission. This runs from background transitions,
      // where a missing row simply means "not enabled".
      const prefs = await queryFirst<NotificationPreferences>(
        'SELECT * FROM notification_preferences WHERE id = 1'
      );
      return !!(prefs?.notifications_enabled && prefs?.daily_reminder_enabled);
    } catch (error) {
      console.error('❌ Error checking notification preferences:', error);
      return false;
    }
  }

  /**
   * Get user notification preferences from database
   */
  async getNotificationPreferences(): Promise<NotificationPreferences | null> {
    try {
      const prefs = await queryFirst<NotificationPreferences>(
        'SELECT * FROM notification_preferences WHERE id = 1'
      );
      
      // If no preferences exist, create default ones
      if (!prefs) {
        log('🔔 No notification preferences found, creating defaults...');
        await this.createDefaultNotificationPreferences();
        return await queryFirst<NotificationPreferences>(
          'SELECT * FROM notification_preferences WHERE id = 1'
        );
      }
      
      return prefs;
    } catch (error) {
      console.error('❌ Error getting notification preferences:', error);
      return null;
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(updates: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      const currentPrefs = await this.getNotificationPreferences();
      if (!currentPrefs) {
        await this.createDefaultNotificationPreferences();
      }

      const fields = Object.keys(updates).filter(key => key !== 'id').join(' = ?, ') + ' = ?';
      const values = Object.entries(updates)
        .filter(([key]) => key !== 'id')
        .map(([, value]) => value);
      values.push(new Date().toISOString()); // updated_at

      await execute(
        `UPDATE notification_preferences SET ${fields}, updated_at = ? WHERE id = 1`,
        values
      );

      // If notifications were disabled, cancel any scheduled notifications
      if (updates.notifications_enabled === false || updates.daily_reminder_enabled === false) {
        await this.cancelScheduledNotification();
      }

      return true;
    } catch (error) {
      console.error('❌ Error updating notification preferences:', error);
      return false;
    }
  }

  /**
   * Check if this is a fresh app installation (no notification preferences exist yet)
   */
  async isFirstInstallation(): Promise<boolean> {
    try {
      const prefs = await queryFirst('SELECT id FROM notification_preferences WHERE id = 1');
      return !prefs;
    } catch {
      // If we can't check, assume it's not a first install
      return false;
    }
  }

  /**
   * Create default notification preferences
   * On first install, automatically request permissions and enable notifications if granted
   */
  private async createDefaultNotificationPreferences(): Promise<void> {
    try {
      // Check if this is a first-time installation
      const existingPrefs = await queryFirst('SELECT id FROM notification_preferences WHERE id = 1');
      const isFirstInstall = !existingPrefs;
      
      // Never prompt here: this runs at app start, before the user knows why.
      // Onboarding asks with context (and records the answer); until then the
      // reminder is "on" in the DB but only schedules once permission exists.
      const notificationsEnabled = true;
      const dailyRemindersEnabled = true;
      
      // Insert or replace default values with permission-based settings
      await execute(`
        INSERT OR IGNORE INTO notification_preferences (
          id, notifications_enabled, daily_reminder_enabled, daily_reminder_hours_after_last_open,
          daily_reminder_title, daily_reminder_body, created_at, updated_at
        ) VALUES (1, ?, ?, 5, 'Time to read! 📚', 
          'You haven''t reached your daily reading goal yet. Keep your streak going!',
          datetime('now'), datetime('now'))
      `, [notificationsEnabled ? 1 : 0, dailyRemindersEnabled ? 1 : 0]);
      
      if (isFirstInstall) {
        log('🔔 Created default notification preferences for first install:', {
          notifications_enabled: notificationsEnabled,
          daily_reminder_enabled: dailyRemindersEnabled,
          daily_reminder_hours_after_last_open: 5
        });
      } else {
        log('🔔 Updated existing notification preferences');
      }
    } catch (error) {
      console.error('❌ Error creating default notification preferences:', error);
      throw error;
    }
  }

  /**
   * Schedule a daily reminder notification
   * In development: uses minutes for quick testing
   * In production: uses hours as specified in preferences
   */
  async scheduleDailyReminderNotification(): Promise<void> {
    try {
      // Check if user is logged in first
      const isLoggedIn = await this.isUserLoggedIn();
      if (!isLoggedIn) {
        log('👤 No user logged in, skipping notification scheduling');
        return;
      }

      const areEnabled = await this.areNotificationsEnabled();
      if (!areEnabled) {
        log('📵 Notifications disabled, skipping schedule');
        return;
      }

      // Never prompt from here: this runs while the app is going to background
      const hasPermission = await this.checkCurrentPermissions();
      if (!hasPermission) {
        log('📵 No notification permission, skipping schedule');
        return;
      }

      const prefs = await this.getNotificationPreferences();
      if (!prefs) {
        log('📵 No notification preferences found');
        return;
      }

      // Cancel any existing notification
      await this.cancelScheduledNotification();

      // Determine scheduling based on environment
      let triggerSeconds: number;
      let triggerTime = new Date();
      
      if (this.isDevelopment()) {
        // In development: schedule for 1 minute for quick testing
        triggerSeconds = 60; // 1 minute
        triggerTime.setMinutes(triggerTime.getMinutes() + 1);
        log(`🔧 [DEV MODE] Scheduling notification in 1 minute for testing`);
      } else {
        // In production: use hours from preferences, outside quiet hours
        triggerTime.setHours(triggerTime.getHours() + prefs.daily_reminder_hours_after_last_open);
        triggerTime = adjustForQuietHours(triggerTime);
        triggerSeconds = Math.max(60, Math.round((triggerTime.getTime() - Date.now()) / 1000));
      }

      // Schedule the notification
      const enhancedMessage = await this.generateNotificationMessage(
        dateToLocalDateString(triggerTime) === getTodayDateString()
      );

      await this.ensureAndroidChannel();
      await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: {
          title: i18n.t('settings.notificationMessages.defaultTitle'),
          body: enhancedMessage,
          sound: 'default',
          data: {
            type: 'daily_reminder',
            scheduledAt: new Date().toISOString(),
            isDevelopment: this.isDevelopment(),
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: triggerSeconds,
          channelId: ANDROID_CHANNEL_ID,
        },
      });

      log(`✅ Scheduled daily reminder notification for ${triggerTime.toLocaleString()}`);
      
      if (this.isDevelopment()) {
        log(`🔧 [DEV MODE] Notification will appear in 1 minute for testing purposes`);
      }
    } catch (error) {
      console.error('❌ Error scheduling daily reminder notification:', error);
    }
  }

  /**
   * Schedule a test notification for development (custom minutes)
   * This method is only available in development mode
   */
  async scheduleTestNotification(minutes: number = 1): Promise<void> {
    if (!this.isDevelopment()) {
      log('⚠️ Test notifications are only available in development mode');
      return;
    }

    try {
      // Check if user is logged in first
      const isLoggedIn = await this.isUserLoggedIn();
      if (!isLoggedIn) {
        log('👤 No user logged in, skipping test notification scheduling');
        return;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        log('📵 No notification permission for test notification');
        return;
      }

      // Cancel any existing notification
      await this.cancelScheduledNotification();

      const triggerTime = new Date();
      triggerTime.setMinutes(triggerTime.getMinutes() + minutes);

      // Schedule the test notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Test Notification',
          body: `This is a test notification scheduled ${minutes} minute(s) ago when the app was last opened.`,
          sound: 'default',
          data: {
            type: 'test_notification',
            scheduledAt: new Date().toISOString(),
            minutesAfterOpen: minutes,
            isDevelopment: true,
          },
        },
        trigger: { 
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: minutes * 60
        },
      });

      log(`🧪 [TEST] Scheduled test notification for ${triggerTime.toLocaleString()} (${minutes} minute(s) from now)`);
    } catch (error) {
      console.error('❌ Error scheduling test notification:', error);
    }
  }

  /**
   * Schedule notification based on time since app was last opened
   * This is the main notification function that schedules based on actual app usage
   */
  async scheduleNotificationBasedOnLastOpen(): Promise<void> {
    try {
      // Check if user is logged in first
      const isLoggedIn = await this.isUserLoggedIn();
      if (!isLoggedIn) {
        log('👤 No user logged in, skipping notification scheduling based on last open');
        return;
      }

      const areEnabled = await this.areNotificationsEnabled();
      if (!areEnabled) {
        log('📵 Notifications disabled, skipping schedule based on last open');
        return;
      }

      // Never prompt from here: this runs while the app is going to background
      const hasPermission = await this.checkCurrentPermissions();
      if (!hasPermission) {
        log('📵 No notification permission, skipping schedule based on last open');
        return;
      }

      const prefs = await this.getNotificationPreferences();
      if (!prefs) {
        log('📵 No notification preferences found');
        return;
      }

      // Get the last time the app was opened
      const lastOpenedTime = await this.getLastOpenedTime();
      if (!lastOpenedTime) {
        log('📝 No last opened time found, scheduling from now');
        await this.scheduleDailyReminderNotification();
        return;
      }

      // Calculate time elapsed since last open
      const now = new Date();
      const timeSinceLastOpen = now.getTime() - lastOpenedTime.getTime();
      const hoursSinceLastOpen = timeSinceLastOpen / (1000 * 60 * 60);

      // Cancel any existing notification
      await this.cancelScheduledNotification();

      let triggerSeconds: number;
      let triggerTime = new Date();

      if (this.isDevelopment()) {
        // In development: schedule for 1 minute for quick testing
        triggerSeconds = 60; // 1 minute
        triggerTime.setMinutes(triggerTime.getMinutes() + 1);
        log(`🔧 [DEV MODE] Scheduling notification in 1 minute for testing`);
      
      } else {
        // In production: calculate remaining time needed
        const targetHours = prefs.daily_reminder_hours_after_last_open;
        
        if (hoursSinceLastOpen >= targetHours) {
          // Enough time has passed, send notification soon
          triggerSeconds = 60; // 1 minute delay
          triggerTime.setMinutes(triggerTime.getMinutes() + 1);
          log(`📱 ${hoursSinceLastOpen.toFixed(2)} hours have passed since last open (target: ${targetHours}h). Scheduling notification in 1 minute.`);
        } else {
          // Not enough time has passed, schedule for remaining time
          const remainingHours = targetHours - hoursSinceLastOpen;
          triggerTime = new Date(Date.now() + remainingHours * 3600 * 1000);
          log(`📱 ${hoursSinceLastOpen.toFixed(2)} hours have passed since last open. Scheduling notification in ${remainingHours.toFixed(2)} more hours.`);
        }

        triggerTime = adjustForQuietHours(triggerTime);
        triggerSeconds = Math.max(60, Math.round((triggerTime.getTime() - Date.now()) / 1000));
      }

      // Schedule the notification
      const enhancedMessage = await this.generateNotificationMessage(
        dateToLocalDateString(triggerTime) === getTodayDateString()
      );

      await this.ensureAndroidChannel();
      await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: {
          title: i18n.t('settings.notificationMessages.defaultTitle'),
          body: enhancedMessage,
          sound: 'default',
          data: {
            type: 'daily_reminder_based_on_last_open',
            scheduledAt: new Date().toISOString(),
            lastOpenedAt: lastOpenedTime.toISOString(),
            hoursSinceLastOpen: hoursSinceLastOpen,
            isDevelopment: this.isDevelopment(),
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: triggerSeconds,
          channelId: ANDROID_CHANNEL_ID,
        },
      });

      log(`✅ Scheduled notification based on last open time for ${triggerTime.toLocaleString()}`);
    } catch (error) {
      console.error('❌ Error scheduling notification based on last open:', error);
    }
  }

  /**
   * "At a set time" mode: remind at HH:MM today if today's goal isn't met
   * yet, otherwise at HH:MM tomorrow (when that day's goal is still open).
   * The user picked the time, so quiet hours don't apply.
   */
  async scheduleAtDailyTime(time: string, isGoalMetToday: boolean): Promise<void> {
    try {
      // Never prompt here: this runs while the app is going to background
      if (!(await this.checkCurrentPermissions())) {
        log('📵 No notification permission, skipping daily-time reminder');
        return;
      }

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

      await this.ensureAndroidChannel();
      // A "set time" reminder should repeat even if the app isn't opened, so
      // queue the next DAILY_TIME_DAYS days (each later day's goal is untouched,
      // so its message uses the full goal). Opening the app cancels them and
      // leaving it reschedules, so a met goal still suppresses today's.
      for (let day = 0; day < DAILY_TIME_DAYS; day++) {
        const trigger = new Date(first);
        if (day > 0) {
          trigger.setDate(first.getDate() + day);
          trigger.setHours(hours || 0, minutes || 0, 0, 0);
        }
        const firesToday = dateToLocalDateString(trigger) === getTodayDateString();
        await Notifications.scheduleNotificationAsync({
          identifier: day === 0 ? REMINDER_ID : `${REMINDER_ID}-${day}`,
          content: {
            title: i18n.t('settings.notificationMessages.defaultTitle'),
            body: await this.generateNotificationMessage(firesToday),
            sound: 'default',
            data: { type: 'daily_reminder_at_time', scheduledFor: trigger.toISOString() },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: trigger,
            channelId: ANDROID_CHANNEL_ID,
          },
        });
      }
      log(`✅ Scheduled ${DAILY_TIME_DAYS} daily-time reminders from ${first.toLocaleString()}`);
    } catch (error) {
      console.error('❌ Error scheduling daily-time reminder:', error);
    }
  }


  /**
   * Cancel the currently scheduled notification
   */
  async cancelScheduledNotification(): Promise<void> {
    try {
      // The reminder plus the queued "set time" days (see scheduleAtDailyTime)
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

  /**
   * Check if daily reading goal has been met today
   */
  async isDailyGoalMet(): Promise<boolean> {
    try {
      if (!(await this.isUserLoggedIn())) return false;
      const [dailyGoal, minutesToday] = await Promise.all([
        getDailyGoal(),
        getTodayReadingMinutes(),
      ]);
      return minutesToday >= dailyGoal;
    } catch (error) {
      console.error('❌ Error checking daily goal:', error);
      return false;
    }
  }


  /**
   * Get remaining time to reach daily reading goal
   */
  async getRemainingTimeToGoal(): Promise<{
    remainingMinutes: number;
    dailyGoal: number;
    minutesRead: number;
    formattedTime: string;
  }> {
    try {
      const dailyGoal = await getDailyGoal();
      const minutesRead = await getTodayReadingMinutes();
      const remainingMinutes = Math.max(0, dailyGoal - minutesRead);

      return {
        remainingMinutes,
        dailyGoal,
        minutesRead,
        formattedTime: formatDuration(remainingMinutes, 'long')
      };
    } catch (error) {
      console.error('❌ Error getting remaining time to goal:', error);
      return {
        remainingMinutes: 30,
        dailyGoal: 30,
        minutesRead: 0,
        formattedTime: formatDuration(30, 'long')
      };
    }
  }



  /**
   * Generate a localized notification message with remaining time to goal.
   * When the reminder fires on a later day (pushed past quiet hours), that
   * day's goal is untouched, so the full goal is what remains.
   */
  async generateNotificationMessage(firesToday: boolean = true): Promise<string> {
    const key = 'settings.notificationMessages';
    const baseMessage = i18n.t(`${key}.defaultMessage`);
    try {
      const goalStatus = await this.getRemainingTimeToGoal();
      const remainingMinutes = firesToday ? goalStatus.remainingMinutes : goalStatus.dailyGoal;

      if (remainingMinutes === 0) {
        return i18n.t(`${key}.goalCompleted`);
      }

      return i18n.t(`${key}.goalRemaining`, {
        baseMessage,
        remainingTime: formatDuration(remainingMinutes, 'long'),
        dailyGoal: goalStatus.dailyGoal,
      });
    } catch (error) {
      console.error('❌ Error generating notification message:', error);
      return baseMessage;
    }
  }

  /**
   * Check if notification should be sent and schedule if needed
   * This is the main method that schedules notifications based on when the app was last opened
   */
  async checkAndScheduleNotification(): Promise<void> {
    try {
      // Check if user is logged in first
      const isLoggedIn = await this.isUserLoggedIn();
      if (!isLoggedIn) {
        log('👤 No user logged in, skipping notification check and scheduling');
        return;
      }

      // In both early-return cases, drop a reminder scheduled earlier today
      // (e.g. by a previous log that didn't reach the goal yet)
      const areEnabled = await this.areNotificationsEnabled();
      if (!areEnabled) {
        await this.cancelScheduledNotification();
        return;
      }

      const isGoalMet = await this.isDailyGoalMet();

      const prefs = await queryFirst<NotificationPreferences>(
        'SELECT * FROM notification_preferences WHERE id = 1'
      );
      if (prefs?.reminder_mode === 'daily_time') {
        await this.scheduleAtDailyTime(prefs.reminder_time ?? '20:00', isGoalMet);
        return;
      }

      if (isGoalMet) {
        log('🎯 Daily goal already met, no notification needed');
        await this.cancelScheduledNotification();
        return;
      }

      // Schedule notification based on last open time
      await this.scheduleNotificationBasedOnLastOpen();
    } catch (error) {
      console.error('❌ Error in checkAndScheduleNotification:', error);
    }
  }

  /**
   * Handle app foreground/background state changes
   */
  onAppStateChange(nextAppState: string): Promise<void> {
    this.appStateQueue = this.appStateQueue.then(() =>
      this.handleAppStateChange(nextAppState)
    );
    return this.appStateQueue;
  }

  private async handleAppStateChange(nextAppState: string): Promise<void> {
    try {
      if (nextAppState === 'active') {
        // App came to foreground
        await this.trackAppOpened();
        
        // Cancel any pending notifications since user is now active
        await this.cancelScheduledNotification();
      } else if (nextAppState === 'background') {
        // Only 'background', not 'inactive': iOS reports 'inactive' for Control
        // Center, Face ID, system alerts and on the way to background
        // App went to background
        await this.trackAppClosed();
        
        // Schedule notification if goal not met
        await this.checkAndScheduleNotification();
      }
    } catch (error) {
      console.error('❌ Error handling app state change:', error);
    }
  }

  /**
   * Track when app is opened
   */
  private async trackAppOpened(): Promise<void> {
    try {
      const now = new Date();
      const today = dateToLocalDateString(now);
      
      // Check if we have a record for today
      const existing = await queryFirst<AppUsageTracking>(
        'SELECT * FROM app_usage_tracking WHERE date = ? ORDER BY id DESC LIMIT 1',
        [today]
      );

      if (existing) {
        // Update existing record
        await execute(
          `UPDATE app_usage_tracking 
           SET last_opened_at = ?, session_count_today = session_count_today + 1 
           WHERE id = ?`,
          [now.toISOString(), existing.id]
        );
      } else {
        // Create new record for today
        await execute(
          `INSERT INTO app_usage_tracking (last_opened_at, session_count_today, date) 
           VALUES (?, 1, ?)`,
          [now.toISOString(), today]
        );
      }
    } catch (error) {
      console.error('❌ Error tracking app opened:', error);
    }
  }

  /**
   * Track when app is closed/backgrounded
   */
  private async trackAppClosed(): Promise<void> {
    try {
      const now = new Date();
      const today = dateToLocalDateString(now);
      
      // Update the most recent record for today
      await execute(
        `UPDATE app_usage_tracking 
         SET last_closed_at = ? 
         WHERE date = ? AND id = (
           SELECT id FROM app_usage_tracking WHERE date = ? ORDER BY id DESC LIMIT 1
         )`,
        [now.toISOString(), today, today]
      );
    } catch (error) {
      console.error('❌ Error tracking app closed:', error);
    }
  }

  /**
   * Get the last time the app was opened
   */
  async getLastOpenedTime(): Promise<Date | null> {
    try {
      const result = await queryFirst<{last_opened_at: string}>(
        'SELECT last_opened_at FROM app_usage_tracking ORDER BY id DESC LIMIT 1'
      );
      
      return result ? new Date(result.last_opened_at) : null;
    } catch (error) {
      console.error('❌ Error getting last opened time:', error);
      return null;
    }
  }

  /**
   * Development utility: Send an immediate test notification
   */
  async sendImmediateTestNotification(): Promise<void> {
    if (!this.isDevelopment()) {
      log('⚠️ Immediate test notifications are only available in development mode');
      return;
    }

    try {
      // Check if user is logged in first
      const isLoggedIn = await this.isUserLoggedIn();
      if (!isLoggedIn) {
        log('👤 No user logged in, skipping immediate test notification');
        return;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        log('📵 No notification permission for immediate test');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Immediate Test Notification',
          body: 'This is an immediate test notification to verify the notification system is working.',
          sound: 'default',
          data: {
            type: 'immediate_test',
            sentAt: new Date().toISOString(),
            isDevelopment: true,
          },
        },
        trigger: null, // Send immediately
      });

      log('🧪 [TEST] Sent immediate test notification');
    } catch (error) {
      console.error('❌ Error sending immediate test notification:', error);
    }
  }

  /**
   * Development utility: Get notification scheduling status
   */
  async getNotificationStatus(): Promise<{
    enabled: boolean;
    hasPermission: boolean;
    isDevelopment: boolean;
    lastOpenedTime: Date | null;
    scheduledNotifications: number;
    preferences: NotificationPreferences | null;
  }> {
    try {
      const [enabled, permissions, lastOpened, scheduled, prefs] = await Promise.all([
        this.areNotificationsEnabled(),
        this.checkCurrentPermissions(),
        this.getLastOpenedTime(),
        Notifications.getAllScheduledNotificationsAsync(),
        this.getNotificationPreferences()
      ]);

      const status = {
        enabled,
        hasPermission: permissions,
        isDevelopment: this.isDevelopment(),
        lastOpenedTime: lastOpened,
        scheduledNotifications: scheduled.length,
        preferences: prefs
      };

      if (this.isDevelopment()) {
        log('📊 [DEV] Notification Status:', status);
      }

      return status;
    } catch (error) {
      console.error('❌ Error getting notification status:', error);
      return {
        enabled: false,
        hasPermission: false,
        isDevelopment: this.isDevelopment(),
        lastOpenedTime: null,
        scheduledNotifications: 0,
        preferences: null
      };
    }
  }

  /**
   * Clean up all notification data and scheduled notifications
   * This should be called when user data is reset/logout
   */
  async cleanup(): Promise<void> {
    try {
      log('🧹 Cleaning up notification service...');
      
      // Cancel everything, including reminders scheduled by older app
      // versions under random identifiers
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      log('✅ Notification service cleanup completed');
    } catch (error) {
      console.error('❌ Error during notification cleanup:', error);
    }
  }

  /**
   * Reset notification service state - useful after database reset
   */
  async reset(): Promise<void> {
    try {
      log('🔔 Resetting notification service...');
      
      // First clean up any existing state
      await this.cleanup();
      await this.ensureAndroidChannel();
      
      // Make sure the preferences row exists (the schema is guaranteed by the
      // migrations in db/db.tsx, which run before this)
      await this.getNotificationPreferences();
    } catch (error) {
      console.error('❌ Error resetting notification service:', error);
      // Don't throw the error, just log it so app initialization can continue
    }
  }
}

export default NotificationService.getInstance();
