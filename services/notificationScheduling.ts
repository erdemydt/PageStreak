import * as Notifications from "expo-notifications";
import type { NotificationPreferences } from "../db/db";

type NotificationSchedulingDependencies = {
  isUserLoggedIn: () => Promise<boolean>;
  areNotificationsEnabled: () => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
  getNotificationPreferences: () => Promise<NotificationPreferences | null>;
  cancelScheduledNotification: () => Promise<void>;
  generateNotificationMessage: (baseMessage: string) => Promise<string>;
  setNotificationIdentifier: (identifier: string | null) => void;
};

type LastOpenSchedulingDependencies = NotificationSchedulingDependencies & {
  getLastOpenedTime: () => Promise<Date | null>;
  scheduleDailyReminderFallback: () => Promise<void>;
};

export const scheduleDailyReminderNotification = async ({
  isUserLoggedIn,
  areNotificationsEnabled,
  requestPermissions,
  getNotificationPreferences,
  cancelScheduledNotification,
  generateNotificationMessage,
  setNotificationIdentifier,
}: NotificationSchedulingDependencies): Promise<void> => {
  try {
    const isLoggedIn = await isUserLoggedIn();
    if (!isLoggedIn) {
      console.log("👤 No user logged in, skipping notification scheduling");
      return;
    }

    const areEnabled = await areNotificationsEnabled();
    if (!areEnabled) {
      console.log("📵 Notifications disabled, skipping schedule");
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log("📵 No notification permission, skipping schedule");
      return;
    }

    const preferences = await getNotificationPreferences();
    if (!preferences) {
      console.log("📵 No notification preferences found");
      return;
    }

    await cancelScheduledNotification();

    const triggerSeconds =
      preferences.daily_reminder_hours_after_last_open * 3600;
    const triggerTime = new Date();
    triggerTime.setHours(
      triggerTime.getHours() + preferences.daily_reminder_hours_after_last_open,
    );

    const enhancedMessage = await generateNotificationMessage(
      preferences.daily_reminder_body,
    );

    const notificationIdentifier =
      await Notifications.scheduleNotificationAsync({
        content: {
          title: preferences.daily_reminder_title,
          body: enhancedMessage,
          sound: "default",
          data: {
            type: "daily_reminder",
            scheduledAt: new Date().toISOString(),
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: triggerSeconds,
        },
      });

    setNotificationIdentifier(notificationIdentifier);

    console.log(
      `✅ Scheduled daily reminder notification for ${triggerTime.toLocaleString()}`,
    );
  } catch (error) {
    console.error("❌ Error scheduling daily reminder notification:", error);
  }
};

export const scheduleNotificationBasedOnLastOpen = async ({
  isUserLoggedIn,
  areNotificationsEnabled,
  requestPermissions,
  getNotificationPreferences,
  cancelScheduledNotification,
  generateNotificationMessage,
  getLastOpenedTime,
  scheduleDailyReminderFallback,
  setNotificationIdentifier,
}: LastOpenSchedulingDependencies): Promise<void> => {
  try {
    const isLoggedIn = await isUserLoggedIn();
    if (!isLoggedIn) {
      console.log(
        "👤 No user logged in, skipping notification scheduling based on last open",
      );
      return;
    }

    const areEnabled = await areNotificationsEnabled();
    if (!areEnabled) {
      console.log(
        "📵 Notifications disabled, skipping schedule based on last open",
      );
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log(
        "📵 No notification permission, skipping schedule based on last open",
      );
      return;
    }

    const preferences = await getNotificationPreferences();
    if (!preferences) {
      console.log("📵 No notification preferences found");
      return;
    }

    const lastOpenedTime = await getLastOpenedTime();
    if (!lastOpenedTime) {
      console.log("📝 No last opened time found, scheduling from now");
      await scheduleDailyReminderFallback();
      return;
    }

    const now = new Date();
    const timeSinceLastOpen = now.getTime() - lastOpenedTime.getTime();
    const hoursSinceLastOpen = timeSinceLastOpen / (1000 * 60 * 60);

    await cancelScheduledNotification();

    let triggerSeconds: number;
    const triggerTime = new Date();
    const targetHours = preferences.daily_reminder_hours_after_last_open;

    if (hoursSinceLastOpen >= targetHours) {
      triggerSeconds = 60;
      triggerTime.setMinutes(triggerTime.getMinutes() + 1);
      console.log(
        `📱 ${hoursSinceLastOpen.toFixed(2)} hours have passed since last open (target: ${targetHours}h). Scheduling notification in 1 minute.`,
      );
    } else {
      const remainingHours = targetHours - hoursSinceLastOpen;
      triggerSeconds = remainingHours * 3600;
      triggerTime.setHours(triggerTime.getHours() + remainingHours);
      console.log(
        `📱 ${hoursSinceLastOpen.toFixed(2)} hours have passed since last open. Scheduling notification in ${remainingHours.toFixed(2)} more hours.`,
      );
    }

    const enhancedMessage = await generateNotificationMessage(
      preferences.daily_reminder_body,
    );

    const notificationIdentifier =
      await Notifications.scheduleNotificationAsync({
        content: {
          title: preferences.daily_reminder_title,
          body: enhancedMessage,
          sound: "default",
          data: {
            type: "daily_reminder_based_on_last_open",
            scheduledAt: new Date().toISOString(),
            lastOpenedAt: lastOpenedTime.toISOString(),
            hoursSinceLastOpen,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: triggerSeconds,
        },
      });

    setNotificationIdentifier(notificationIdentifier);

    console.log(
      `✅ Scheduled notification based on last open time for ${triggerTime.toLocaleString()}`,
    );
  } catch (error) {
    console.error(
      "❌ Error scheduling notification based on last open:",
      error,
    );
  }
};
