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

/**
 * Checks if a date string (YYYY-MM-DD) represents today
 */
export const isToday = (dateString: string): boolean => {
  const today = getTodayDateString();
  return dateString === today;
};