import type { NotificationPreferences } from "../../types/models";
import { execute, queryFirst } from "../db";

/**
 * notification_preferences: a single row (id = 1). Both legacy flags
 * (notifications_enabled, daily_reminder_enabled) must be on for the reminder;
 * the UI keeps them in step.
 */

const UPDATABLE_COLUMNS = [
  "notifications_enabled",
  "daily_reminder_enabled",
  "daily_reminder_hours_after_last_open",
  "reminder_mode",
  "reminder_time",
] as const;

/** Read-only: null when the row doesn't exist yet */
export async function readNotificationPreferences(): Promise<NotificationPreferences | null> {
  return queryFirst<NotificationPreferences>(
    "SELECT * FROM notification_preferences WHERE id = 1",
  );
}

/**
 * The row, created with defaults if missing. Never asks for permission:
 * defaults say "on", but nothing schedules without permission, and the
 * boot-time permission sync turns the flags off when it's missing.
 */
export async function ensureNotificationPreferences(): Promise<NotificationPreferences | null> {
  await execute(
    `INSERT OR IGNORE INTO notification_preferences (
       id, notifications_enabled, daily_reminder_enabled, daily_reminder_hours_after_last_open,
       daily_reminder_title, daily_reminder_body, created_at, updated_at
     ) VALUES (1, 1, 1, 5, 'Time to read! 📚',
       'You haven''t reached your daily reading goal yet. Keep your streak going!',
       datetime('now'), datetime('now'))`,
  );
  return readNotificationPreferences();
}

export async function writeNotificationPreferences(
  updates: Partial<NotificationPreferences>,
): Promise<void> {
  await ensureNotificationPreferences();
  const entries = Object.entries(updates).filter(([key]) =>
    (UPDATABLE_COLUMNS as readonly string[]).includes(key),
  );
  if (entries.length === 0) return;

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  await execute(
    `UPDATE notification_preferences SET ${assignments}, updated_at = ? WHERE id = 1`,
    [...entries.map(([, value]) => value), new Date().toISOString()],
  );
}

/** Whether the user wants the reminder (read-only; a missing row means no) */
export async function areRemindersEnabled(): Promise<boolean> {
  try {
    const prefs = await readNotificationPreferences();
    return !!(prefs?.notifications_enabled && prefs?.daily_reminder_enabled);
  } catch (error) {
    console.error("❌ Error checking notification preferences:", error);
    return false;
  }
}
