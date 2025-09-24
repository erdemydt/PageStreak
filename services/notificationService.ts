import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppUsageTracking, checkNotificationDatabaseIntegrity, execute, NotificationPreferences, queryFirst, repairNotificationDatabase } from '../db/db';
import { dateToLocalDateString, getTodayDateString } from '../utils/dateUtils';
import { isDevModeEnabled } from '../utils/devMode';

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
  private notificationIdentifier: string | null = null;

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
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

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
        console.log('📝 No preferences found, creating defaults');
        return;
      }

      console.log('🔄 Syncing permissions:', {
        hasSystemPermission,
        dbNotificationsEnabled: prefs.notifications_enabled,
        dbDailyReminderEnabled: prefs.daily_reminder_enabled
      });

      // If system permissions are denied but database shows enabled, update database
      if (!hasSystemPermission && (prefs.notifications_enabled || prefs.daily_reminder_enabled)) {
        console.log('🔄 System permissions denied, updating database to reflect this');
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
      const prefs = await this.getNotificationPreferences();
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
        console.log('🔔 No notification preferences found, creating defaults...');
        await this.createDefaultNotificationPreferences();
        return await queryFirst<NotificationPreferences>(
          'SELECT * FROM notification_preferences WHERE id = 1'
        );
      }
      
      return prefs;
    } catch (error) {
      console.error('❌ Error getting notification preferences:', error);
      
      // If table doesn't exist, it might be due to database reset
      // Try to create default preferences
      try {
        await this.createDefaultNotificationPreferences();
        return await queryFirst<NotificationPreferences>(
          'SELECT * FROM notification_preferences WHERE id = 1'
        );
      } catch (createError) {
        console.error('❌ Failed to create default notification preferences:', createError);
        return null;
      }
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
    } catch (error) {
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
      // First ensure the table exists
      await execute(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id INTEGER PRIMARY KEY,
          notifications_enabled BOOLEAN DEFAULT 1,
          daily_reminder_enabled BOOLEAN DEFAULT 1,
          daily_reminder_hours_after_last_open INTEGER DEFAULT 5,
          daily_reminder_title TEXT DEFAULT 'Time to read! 📚',
          daily_reminder_body TEXT DEFAULT 'You haven''t reached your daily reading goal yet. Keep your streak going!',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Check if this is a first-time installation
      const existingPrefs = await queryFirst('SELECT id FROM notification_preferences WHERE id = 1');
      const isFirstInstall = !existingPrefs;
      
      // On first install, try to request notification permissions
      let notificationsEnabled = true; // Default to true
      let dailyRemindersEnabled = true; // Default to true
      
      if (isFirstInstall) {
        console.log('🔔 First app installation detected, requesting notification permissions...');
        
        try {
          const hasPermission = await this.requestPermissions();
          if (hasPermission) {
            console.log('✅ Notification permissions granted on first install');
            notificationsEnabled = true;
            dailyRemindersEnabled = true;
          } else {
            console.log('❌ Notification permissions denied on first install');
            notificationsEnabled = false;
            dailyRemindersEnabled = false;
          }
        } catch (permissionError) {
          console.error('⚠️ Error requesting permissions on first install:', permissionError);
          // Default to enabled in database, but they'll need to enable in system settings
          notificationsEnabled = true;
          dailyRemindersEnabled = true;
        }
      }
      
      // Insert or replace default values with permission-based settings
      await execute(`
        INSERT OR REPLACE INTO notification_preferences (
          id, notifications_enabled, daily_reminder_enabled, daily_reminder_hours_after_last_open,
          daily_reminder_title, daily_reminder_body, created_at, updated_at
        ) VALUES (1, ?, ?, 5, 'Time to read! 📚', 
          'You haven''t reached your daily reading goal yet. Keep your streak going!',
          datetime('now'), datetime('now'))
      `, [notificationsEnabled ? 1 : 0, dailyRemindersEnabled ? 1 : 0]);
      
      if (isFirstInstall) {
        console.log('🔔 Created default notification preferences for first install:', {
          notifications_enabled: notificationsEnabled,
          daily_reminder_enabled: dailyRemindersEnabled,
          daily_reminder_hours_after_last_open: 5
        });
      } else {
        console.log('🔔 Updated existing notification preferences');
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
        console.log('👤 No user logged in, skipping notification scheduling');
        return;
      }

      const areEnabled = await this.areNotificationsEnabled();
      if (!areEnabled) {
        console.log('📵 Notifications disabled, skipping schedule');
        return;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('📵 No notification permission, skipping schedule');
        return;
      }

      const prefs = await this.getNotificationPreferences();
      if (!prefs) {
        console.log('📵 No notification preferences found');
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
        console.log(`🔧 [DEV MODE] Scheduling notification in 1 minute for testing`);
      } else {
        // In production: use hours from preferences
        triggerSeconds = prefs.daily_reminder_hours_after_last_open * 3600;
        triggerTime.setHours(triggerTime.getHours() + prefs.daily_reminder_hours_after_last_open);
      }

      // Schedule the notification
      const enhancedMessage = await this.generateNotificationMessage(prefs.daily_reminder_body);
      
      this.notificationIdentifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: prefs.daily_reminder_title,
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
          seconds: triggerSeconds
        },
      });

      console.log(`✅ Scheduled daily reminder notification for ${triggerTime.toLocaleString()}`);
      
      if (this.isDevelopment()) {
        console.log(`🔧 [DEV MODE] Notification will appear in 1 minute for testing purposes`);
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
      console.log('⚠️ Test notifications are only available in development mode');
      return;
    }

    try {
      // Check if user is logged in first
      const isLoggedIn = await this.isUserLoggedIn();
      if (!isLoggedIn) {
        console.log('👤 No user logged in, skipping test notification scheduling');
        return;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('📵 No notification permission for test notification');
        return;
      }

      // Cancel any existing notification
      await this.cancelScheduledNotification();

      const triggerTime = new Date();
      triggerTime.setMinutes(triggerTime.getMinutes() + minutes);

      // Schedule the test notification
      this.notificationIdentifier = await Notifications.scheduleNotificationAsync({
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

      console.log(`🧪 [TEST] Scheduled test notification for ${triggerTime.toLocaleString()} (${minutes} minute(s) from now)`);
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
        console.log('👤 No user logged in, skipping notification scheduling based on last open');
        return;
      }

      const areEnabled = await this.areNotificationsEnabled();
      if (!areEnabled) {
        console.log('📵 Notifications disabled, skipping schedule based on last open');
        return;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('📵 No notification permission, skipping schedule based on last open');
        return;
      }

      const prefs = await this.getNotificationPreferences();
      if (!prefs) {
        console.log('📵 No notification preferences found');
        return;
      }

      // Get the last time the app was opened
      const lastOpenedTime = await this.getLastOpenedTime();
      if (!lastOpenedTime) {
        console.log('📝 No last opened time found, scheduling from now');
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
        console.log(`🔧 [DEV MODE] Scheduling notification in 1 minute for testing`);
      
      } else {
        // In production: calculate remaining time needed
        const targetHours = prefs.daily_reminder_hours_after_last_open;
        
        if (hoursSinceLastOpen >= targetHours) {
          // Enough time has passed, send notification soon
          triggerSeconds = 60; // 1 minute delay
          triggerTime.setMinutes(triggerTime.getMinutes() + 1);
          console.log(`📱 ${hoursSinceLastOpen.toFixed(2)} hours have passed since last open (target: ${targetHours}h). Scheduling notification in 1 minute.`);
        } else {
          // Not enough time has passed, schedule for remaining time
          const remainingHours = targetHours - hoursSinceLastOpen;
          triggerSeconds = remainingHours * 3600;
          triggerTime.setHours(triggerTime.getHours() + remainingHours);
          console.log(`📱 ${hoursSinceLastOpen.toFixed(2)} hours have passed since last open. Scheduling notification in ${remainingHours.toFixed(2)} more hours.`);
        }
      }

      // Schedule the notification
      const enhancedMessage = await this.generateNotificationMessage(prefs.daily_reminder_body);
      
      this.notificationIdentifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: prefs.daily_reminder_title,
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
          seconds: triggerSeconds
        },
      });

      console.log(`✅ Scheduled notification based on last open time for ${triggerTime.toLocaleString()}`);
    } catch (error) {
      console.error('❌ Error scheduling notification based on last open:', error);
    }
  }

  /**
   * Cancel the currently scheduled notification
   */
  async cancelScheduledNotification(): Promise<void> {
    try {
      if (this.notificationIdentifier) {
        await Notifications.cancelScheduledNotificationAsync(this.notificationIdentifier);
        this.notificationIdentifier = null;
        console.log('✅ Cancelled scheduled notification');
      }
      
      // Also cancel all scheduled notifications as a fallback
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('❌ Error cancelling notification:', error);
    }
  }

  /**
   * Check if daily reading goal has been met today
   */
  async isDailyGoalMet(): Promise<boolean> {
    try {
      const today = getTodayDateString();
      
      // Get user's current daily reading goal with fallback for missing columns
      let userPrefs;
      try {
        // First try to get the current reading rate if the column exists
        userPrefs = await queryFirst<{current_reading_rate_minutes_per_day: number}>(
          'SELECT current_reading_rate_minutes_per_day FROM user_preferences WHERE id = 1'
        );
      } catch (columnError) {
        // If the column doesn't exist, fall back to basic user preferences
        console.log('📝 current_reading_rate_minutes_per_day column not found, using default goal');
        userPrefs = null;
      }
      
      // Determine daily goal with fallbacks
      let dailyGoal = 30; // Default fallback
      
      if (userPrefs?.current_reading_rate_minutes_per_day) {
        dailyGoal = userPrefs.current_reading_rate_minutes_per_day;
      } else {
        // Try to get from other possible columns as fallback
        try {
          const basicUserPrefs = await queryFirst<{yearly_book_goal?: number}>(
            'SELECT yearly_book_goal FROM user_preferences WHERE id = 1'
          );
          // If user exists but no current reading rate, use a calculated default
          if (basicUserPrefs) {
            dailyGoal = 30; // Conservative default
          } else {
            // No user preferences exist yet
            return false;
          }
        } catch (error) {
          console.log('📝 No user preferences found, assuming goal not met');
          return false;
        }
      }

      // Get today's total reading minutes
      let todayStats;
      try {
        todayStats = await queryFirst<{total_minutes: number}>(
          `SELECT SUM(minutes_read) as total_minutes 
           FROM reading_sessions 
           WHERE date = ?`,
          [today]
        );
      } catch (sessionError) {
        // reading_sessions table might not exist yet
        console.log('📝 reading_sessions table not found, assuming no reading today');
        return false;
      }

      const totalMinutesToday = todayStats?.total_minutes || 0;
      return totalMinutesToday >= dailyGoal;
      
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
      const today = getTodayDateString();
      
      // Get user's daily reading goal
      let userPrefs;
      try {
        userPrefs = await queryFirst<{current_reading_rate_minutes_per_day: number}>(
          'SELECT current_reading_rate_minutes_per_day FROM user_preferences WHERE id = 1'
        );
      } catch (columnError) {
        userPrefs = null;
      }
      
      const dailyGoal = userPrefs?.current_reading_rate_minutes_per_day || 30;

      // Get today's total reading minutes
      let todayStats;
      try {
        todayStats = await queryFirst<{total_minutes: number}>(
          `SELECT SUM(minutes_read) as total_minutes 
           FROM reading_sessions 
           WHERE date = ?`,
          [today]
        );
      } catch (sessionError) {
        todayStats = null;
      }

      const minutesRead = todayStats?.total_minutes || 0;
      const remainingMinutes = Math.max(0, dailyGoal - minutesRead);

      // Format remaining time
      let formattedTime = '';
      if (remainingMinutes === 0) {
        formattedTime = '0 minutes';
      } else if (remainingMinutes < 60) {
        formattedTime = `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
      } else {
        const hours = Math.floor(remainingMinutes / 60);
        const minutes = remainingMinutes % 60;
        if (minutes === 0) {
          formattedTime = `${hours} hour${hours !== 1 ? 's' : ''}`;
        } else {
          formattedTime = `${hours}h ${minutes}m`;
        }
      }

      return {
        remainingMinutes,
        dailyGoal,
        minutesRead,
        formattedTime
      };
    } catch (error) {
      console.error('❌ Error getting remaining time to goal:', error);
      return {
        remainingMinutes: 30,
        dailyGoal: 30,
        minutesRead: 0,
        formattedTime: '30 minutes'
      };
    }
  }

  /**
   * Generate notification message with remaining time to goal
   */
  async generateNotificationMessage(baseMessage: string): Promise<string> {
    try {
      const goalStatus = await this.getRemainingTimeToGoal();
      
      if (goalStatus.remainingMinutes === 0) {
        return 'Congratulations! You\'ve already reached your daily reading goal! 🎉';
      }
      
      return `${baseMessage} You have ${goalStatus.formattedTime} left to reach your daily goal of ${goalStatus.dailyGoal} minutes.`;
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
        console.log('👤 No user logged in, skipping notification check and scheduling');
        return;
      }

      const areEnabled = await this.areNotificationsEnabled();
      if (!areEnabled) {
        return;
      }

      const isGoalMet = await this.isDailyGoalMet();
      if (isGoalMet) {
        console.log('🎯 Daily goal already met, no notification needed');
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
  async onAppStateChange(nextAppState: string): Promise<void> {
    try {
      if (nextAppState === 'active') {
        // App came to foreground
        await this.trackAppOpened();
        
        // Cancel any pending notifications since user is now active
        await this.cancelScheduledNotification();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
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
      
      // If table doesn't exist, try to create it (might be due to database reset)
      try {
        await execute(`
          CREATE TABLE IF NOT EXISTS app_usage_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            last_opened_at DATETIME NOT NULL,
            last_closed_at DATETIME,
            session_count_today INTEGER DEFAULT 1,
            date TEXT NOT NULL
          )
        `);
        
        // Try to track again
        const now = new Date();
        const today = dateToLocalDateString(now);
        await execute(
          `INSERT INTO app_usage_tracking (last_opened_at, session_count_today, date) 
           VALUES (?, 1, ?)`,
          [now.toISOString(), today]
        );
        
        console.log('✅ Recreated app usage tracking table and logged session');
      } catch (recreateError) {
        console.error('❌ Failed to recreate app usage tracking:', recreateError);
      }
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
      
      // If the update failed, try to ensure the tracking table exists and create a basic record
      try {
        await execute(`
          CREATE TABLE IF NOT EXISTS app_usage_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            last_opened_at DATETIME NOT NULL,
            last_closed_at DATETIME,
            session_count_today INTEGER DEFAULT 1,
            date TEXT NOT NULL
          )
        `);
        
        const now = new Date();
        const today = dateToLocalDateString(now);
        
        // Try to insert a basic tracking record
        await execute(
          `INSERT OR IGNORE INTO app_usage_tracking (last_opened_at, last_closed_at, session_count_today, date) 
           VALUES (?, ?, 1, ?)`,
          [now.toISOString(), now.toISOString(), today]
        );
        
        console.log('✅ Recreated app usage tracking and logged close event');
      } catch (recreateError) {
        console.error('❌ Failed to recreate app usage tracking for close event:', recreateError);
      }
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
      console.log('⚠️ Immediate test notifications are only available in development mode');
      return;
    }

    try {
      // Check if user is logged in first
      const isLoggedIn = await this.isUserLoggedIn();
      if (!isLoggedIn) {
        console.log('👤 No user logged in, skipping immediate test notification');
        return;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('📵 No notification permission for immediate test');
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

      console.log('🧪 [TEST] Sent immediate test notification');
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
        this.requestPermissions(),
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
        console.log('📊 [DEV] Notification Status:', status);
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
      console.log('🧹 Cleaning up notification service...');
      
      // Cancel all scheduled notifications
      await this.cancelScheduledNotification();
      
      // Reset internal state
      this.notificationIdentifier = null;
      
      console.log('✅ Notification service cleanup completed');
    } catch (error) {
      console.error('❌ Error during notification cleanup:', error);
    }
  }

  /**
   * Reset notification service state - useful after database reset
   */
  async reset(): Promise<void> {
    try {
      console.log('🔔 Resetting notification service...');
      
      // First clean up any existing state
      await this.cleanup();
      
      // Verify that notification tables exist and are properly set up
      try {
        // Check database integrity
        const integrity = await checkNotificationDatabaseIntegrity();
        
        if (!integrity.notification_preferences_exists || !integrity.notification_preferences_has_defaults) {
          console.log('🔧 Notification tables missing or incomplete, attempting repair...');
          const repairSuccess = await repairNotificationDatabase();
          
          if (!repairSuccess) {
            console.error('❌ Failed to repair notification database');
            return;
          }
        }
        
        // Now try to ensure notification preferences exist
        const prefs = await this.getNotificationPreferences();
        if (prefs) {
          console.log('🔔 Notification service reset successfully and preferences restored');
        } else {
          console.log('⚠️ Notification service reset but could not restore preferences');
        }
      } catch (dbError) {
        console.error('⚠️ Database integrity check failed during reset:', dbError);
        
        // Try to create default preferences directly as a fallback
        try {
          await this.createDefaultNotificationPreferences();
          console.log('🔔 Created default notification preferences as fallback');
        } catch (fallbackError) {
          console.error('❌ Failed to create default notification preferences as fallback:', fallbackError);
        }
      }
    } catch (error) {
      console.error('❌ Error resetting notification service:', error);
      // Don't throw the error, just log it so app initialization can continue
    }
  }
}

export default NotificationService.getInstance();
