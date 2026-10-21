import type { AppUsageTracking } from "../../types/models";
import { dateToLocalDateString, parseDbDate } from "../../utils/dateUtils";
import { execute, queryFirst } from "../db";

/**
 * app_usage_tracking: one row per local day, with the last open/close times.
 * The "after I leave the app" reminder is timed from the last open.
 */

export async function trackAppOpened(): Promise<void> {
  const now = new Date();
  const today = dateToLocalDateString(now);
  const existing = await queryFirst<AppUsageTracking>(
    "SELECT * FROM app_usage_tracking WHERE date = ? ORDER BY id DESC LIMIT 1",
    [today],
  );
  if (existing) {
    await execute(
      `UPDATE app_usage_tracking
       SET last_opened_at = ?, session_count_today = session_count_today + 1
       WHERE id = ?`,
      [now.toISOString(), existing.id],
    );
  } else {
    await execute(
      `INSERT INTO app_usage_tracking (last_opened_at, session_count_today, date)
       VALUES (?, 1, ?)`,
      [now.toISOString(), today],
    );
  }
}

export async function trackAppClosed(): Promise<void> {
  const now = new Date();
  const today = dateToLocalDateString(now);
  await execute(
    `UPDATE app_usage_tracking
     SET last_closed_at = ?
     WHERE date = ? AND id = (
       SELECT id FROM app_usage_tracking WHERE date = ? ORDER BY id DESC LIMIT 1
     )`,
    [now.toISOString(), today, today],
  );
}

/** null when unknown or unreadable (the reminder then counts from now) */
export async function getLastOpenedTime(): Promise<Date | null> {
  try {
    const row = await queryFirst<{ last_opened_at: string }>(
      "SELECT last_opened_at FROM app_usage_tracking ORDER BY id DESC LIMIT 1",
    );
    return parseDbDate(row?.last_opened_at);
  } catch (error) {
    console.error("❌ Error getting last opened time:", error);
    return null;
  }
}
