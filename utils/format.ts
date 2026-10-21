import i18n from "../i18n";
import { parseDbDate } from "./dateUtils";

/**
 * Shared, app-language-aware formatters. Use these instead of per-screen
 * helpers so every screen renders durations and dates the same way.
 */

/** Locale for Intl formatting, following the app language (not the device) */
export const getAppLocale = (): string =>
  i18n.language === "tr" ? "tr-TR" : "en-US";

/**
 * "45 min", "2 h", "1 h 30 min" (short, for UI).
 * "45 minutes", "1h 30m" (long, for notification sentences).
 */
export function formatDuration(
  totalMinutes: number,
  style: "short" | "long" = "short",
): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (style === "long") {
    const key = "settings.notificationMessages";
    if (minutes < 60) {
      return i18n.t(
        minutes === 1 ? `${key}.timeMinute` : `${key}.timeMinutes`,
        {
          count: minutes,
        },
      );
    }
    if (rest === 0) {
      return i18n.t(hours === 1 ? `${key}.timeHour` : `${key}.timeHours`, {
        count: hours,
      });
    }
    return i18n.t(`${key}.timeHoursMinutes`, { hours, minutes: rest });
  }

  if (minutes < 60) return i18n.t("duration.minutes", { count: minutes });
  if (rest === 0) return i18n.t("duration.hours", { count: hours });
  return i18n.t("duration.hoursMinutes", { hours, minutes: rest });
}

/** "March 3, 2026" / "3 Mart 2026" */
export const LONG_DATE: Intl.DateTimeFormatOptions = {
  month: "long",
  day: "numeric",
  year: "numeric",
};

/**
 * Formats any stored date value (see parseDbDate) in the app language.
 * Returns the raw value if it can't be parsed, or "" for empty input.
 */
export function formatDate(
  value?: string | Date | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : parseDbDate(value);
  if (!date) return typeof value === "string" ? value : "";
  return date.toLocaleDateString(getAppLocale(), options);
}
