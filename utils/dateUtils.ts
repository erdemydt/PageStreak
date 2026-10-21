/**
 * Date utility functions to handle timezone-safe date formatting
 * 
 * The main issue is that toISOString() returns UTC dates, which can 
 * show different days than the user's local time zone. This utility
 * ensures consistent date formatting using local time.
 */

/**
 * Converts a Date object to YYYY-MM-DD format using local timezone
 * This is safer than toISOString().split('T')[0] which uses UTC
 */
export const dateToLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Gets today's date in YYYY-MM-DD format using local timezone
 */
export const getTodayDateString = (): string => {
  return dateToLocalDateString(new Date());
};

/**
 * Converts locale string from toLocaleDateString() to YYYY-MM-DD format
 * Handles different locale formats safely
 */
export const localeStringToDateString = (localeString: string): string => {
  // Try to parse the locale string by creating a Date object
  // This handles different locale formats automatically
  try {
    const date = new Date(localeString);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return dateToLocalDateString(date);
  } catch (error) {
    // Fallback: try manual parsing for MM/DD/YYYY format
    console.warn('Failed to parse locale string, trying manual parsing:', localeString);
    const parts = localeString.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      const mm = month.padStart(2, '0');
      const dd = day.padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
    // Last resort: return today's date
    console.error('Failed to parse date string:', localeString);
    return getTodayDateString();
  }
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SQLITE_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/**
 * Parses a YYYY-MM-DD string as local midnight.
 * new Date('YYYY-MM-DD') parses as UTC midnight, which is the previous
 * calendar day for anyone west of UTC.
 */
export const parseLocalDateString = (dateString: string): Date => {
  const match = dateString.match(DATE_ONLY_PATTERN);
  if (!match) {
    return new Date(dateString);
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

/**
 * Parses any date value stored in the database:
 * - 'YYYY-MM-DD' (session dates, some date_finished values) -> local midnight
 * - 'YYYY-MM-DD HH:MM:SS' (SQLite CURRENT_TIMESTAMP / datetime('now')) -> UTC
 * - ISO 8601 strings (written via toISOString()) -> as-is
 * Returns null for empty or unparseable values.
 */
export const parseDbDate = (value?: string | null): Date | null => {
  if (!value) return null;

  if (DATE_ONLY_PATTERN.test(value)) {
    return parseLocalDateString(value);
  }

  const sqliteMatch = value.match(SQLITE_TIMESTAMP_PATTERN);
  if (sqliteMatch) {
    const [, year, month, day, hours, minutes, seconds] = sqliteMatch;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds),
      ),
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Returns the YYYY-MM-DD string `days` days away from the given YYYY-MM-DD string
 */
export const addDaysToDateString = (dateString: string, days: number): string => {
  const date = parseLocalDateString(dateString);
  date.setDate(date.getDate() + days);
  return dateToLocalDateString(date);
};

/**
 * Checks if a date string (YYYY-MM-DD) represents today
 */
export const isToday = (dateString: string): boolean => {
  const today = getTodayDateString();
  return dateString === today;
};