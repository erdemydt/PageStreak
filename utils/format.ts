import i18n from "../i18n";
import {
  addDaysToDateString,
  getTodayDateString,
  parseDbDate,
} from "./dateUtils";

/**
 * Shared, app-language-aware formatters. Use these instead of per-screen
 * helpers so every screen renders durations and dates the same way.
 */

/** Locale for Intl formatting, following the app language (not the device) */
export const getAppLocale = (): string =>
  i18n.language === "tr" ? "tr-TR" : "en-US";

/**
 * Uppercase in the app language. Use this instead of `textTransform: "uppercase"`,
 * which ignores the locale and turns Turkish "i" into "I" instead of "İ".
 * The Turkish pairs are mapped by hand so the result doesn't depend on Hermes' Intl.
 */
export const toAppUpperCase = (text: string): string =>
  i18n.language === "tr"
    ? text.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase()
    : text.toUpperCase();

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

/**
 * "3 Mar", with the year only when it isn't this year. Pass month "long" where
 * the text is uppercased: "22 EKİM" reads better than the clipped "22 EKİ".
 */
export function formatShortDate(
  value?: string | Date | null,
  month: "short" | "long" = "short",
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : parseDbDate(value);
  if (!date) return typeof value === "string" ? value : "";
  return date.toLocaleDateString(getAppLocale(), {
    day: "numeric",
    month,
    ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
}

/** Open Library language code ("eng") to a localized name, else the raw code */
export function formatLanguage(code?: string | null): string {
  if (!code) return "";
  const key = `languages.${code.toLowerCase()}`;
  return i18n.exists(key) ? i18n.t(key) : code.toUpperCase();
}

/** "Today", "Yesterday", else "Tue, Oct 20" (a session's day, in the app language) */
export function formatSessionDay(date: string): string {
  const today = getTodayDateString();
  if (date === today) return i18n.t("components.sessionDate.today");
  if (date === addDaysToDateString(today, -1)) {
    return i18n.t("components.sessionDate.yesterday");
  }
  return formatDate(date, { weekday: "short", day: "numeric", month: "short" });
}

/** "25 min · 12 pages", or just "25 min" when no pages were logged */
export function formatSessionDetail(session: {
  minutes_read: number;
  pages_read?: number | null;
}): string {
  const time = formatDuration(session.minutes_read);
  return session.pages_read
    ? i18n.t("duration.withPages", { time, pages: session.pages_read })
    : time;
}

/** The delete confirmation: says how much reading goes with the book */
export function formatDeleteBookMessage(
  title: string,
  sessionCount: number,
  minutes: number,
): string {
  if (sessionCount === 0) {
    return i18n.t("booksPage.alert.deleteMessage", { title });
  }
  return i18n.t("booksPage.alert.deleteWithSessionsMessage", {
    title,
    sessions: i18n.t(
      sessionCount === 1
        ? "booksPage.alert.sessionCountOne"
        : "booksPage.alert.sessionCountOther",
      { count: sessionCount },
    ),
    time: formatDuration(minutes),
  });
}
