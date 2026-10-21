import type { ReadingSession } from "../../types/models";
import { emitDataChange } from "../../utils/dataEvents";
import { addDaysToDateString, getTodayDateString } from "../../utils/dateUtils";
import { syncBookCurrentPageFromSessions } from "../../utils/readingProgress";
import { execute, queryAll, queryFirst } from "../db";
import { updateBookStatus } from "./books";

/**
 * All writes to reading_sessions go through this module so the book's cached
 * current_page is always re-derived afterwards (CLAUDE.md "Page progress").
 */

export type SessionWithBook = ReadingSession & {
  book_name: string;
  book_author: string;
};

export async function logSession(input: {
  bookId: number;
  minutes: number;
  pages?: number | null;
  notes?: string | null;
  /** YYYY-MM-DD, defaults to today */
  date?: string;
  /** Override created_at (dev data generator); defaults to CURRENT_TIMESTAMP */
  createdAt?: string;
  /** Also mark the book as read */
  finishBook?: boolean;
}): Promise<void> {
  const date = input.date ?? getTodayDateString();
  if (input.createdAt) {
    await execute(
      `INSERT INTO reading_sessions (book_id, minutes_read, pages_read, date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.bookId,
        input.minutes,
        input.pages ?? null,
        date,
        input.notes ?? null,
        input.createdAt,
      ],
    );
  } else {
    await execute(
      `INSERT INTO reading_sessions (book_id, minutes_read, pages_read, date, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.bookId,
        input.minutes,
        input.pages ?? null,
        date,
        input.notes ?? null,
      ],
    );
  }

  if (input.finishBook) {
    await updateBookStatus(input.bookId, "read");
  }
  // Re-derive current_page (pinned to the full count if just finished)
  await syncBookCurrentPageFromSessions(input.bookId);
  emitDataChange("sessions", "books");
}

export async function getSession(id: number): Promise<ReadingSession | null> {
  return queryFirst<ReadingSession>(
    "SELECT * FROM reading_sessions WHERE id = ?",
    [id],
  );
}

export async function updateSession(
  id: number,
  changes: {
    minutes: number;
    notes?: string | null;
    pages?: number | null;
    /** YYYY-MM-DD; unchanged when omitted */
    date?: string;
  },
): Promise<void> {
  const session = await getSession(id);
  if (!session) throw new Error("Session not found");

  await execute(
    "UPDATE reading_sessions SET minutes_read = ?, notes = ?, pages_read = ?, date = ? WHERE id = ?",
    [
      changes.minutes,
      changes.notes || null,
      changes.pages || null,
      changes.date ?? session.date,
      id,
    ],
  );
  // Always re-derive: clearing the pages field must lower progress too
  await syncBookCurrentPageFromSessions(session.book_id);
  emitDataChange("sessions", "books");
}

/** Deletes a session and returns it, so the caller can offer undo (restoreSession) */
export async function deleteSession(id: number): Promise<ReadingSession> {
  const session = await getSession(id);
  if (!session) throw new Error("Session not found");

  await execute("DELETE FROM reading_sessions WHERE id = ?", [id]);
  await syncBookCurrentPageFromSessions(session.book_id);
  emitDataChange("sessions", "books");
  return session;
}

/** Re-insert a session returned by deleteSession (undo) */
export async function restoreSession(session: ReadingSession): Promise<void> {
  await logSession({
    bookId: session.book_id,
    minutes: session.minutes_read,
    pages: session.pages_read ?? null,
    notes: session.notes ?? null,
    date: session.date,
    createdAt: session.created_at,
  });
}

/** Sessions in [startDate, endDate] (YYYY-MM-DD) with their book's name and author */
export async function listSessionsWithBooks(
  startDate: string,
  endDate: string,
): Promise<SessionWithBook[]> {
  return queryAll<SessionWithBook>(
    `SELECT rs.*, eb.name as book_name, eb.author as book_author
     FROM reading_sessions rs
     JOIN enhanced_books eb ON rs.book_id = eb.id
     WHERE rs.date BETWEEN ? AND ?
     ORDER BY rs.date, rs.created_at`,
    [startDate, endDate],
  );
}

/** Minutes per session in [startDate, endDate], without book info */
export async function listSessionMinutes(
  startDate: string,
  endDate: string,
): Promise<{ date: string; minutes_read: number }[]> {
  return queryAll<{ date: string; minutes_read: number }>(
    "SELECT date, minutes_read FROM reading_sessions WHERE date BETWEEN ? AND ?",
    [startDate, endDate],
  );
}

/** Total minutes per day, optionally only up to `untilDate` */
export async function getDailyTotals(
  untilDate?: string,
): Promise<{ date: string; total_minutes: number }[]> {
  return queryAll<{ date: string; total_minutes: number }>(
    `SELECT date, SUM(minutes_read) as total_minutes
     FROM reading_sessions
     ${untilDate ? "WHERE date <= ?" : ""}
     GROUP BY date
     ORDER BY date DESC`,
    untilDate ? [untilDate] : [],
  );
}

export async function getFirstSessionDate(): Promise<string | null> {
  const row = await queryFirst<{ first_date: string | null }>(
    "SELECT MIN(date) as first_date FROM reading_sessions",
  );
  return row?.first_date ?? null;
}

/**
 * Reading pace from sessions that recorded pages: this book's when it has
 * enough data, else across all books. null when there's too little to say.
 */
export async function getPagesPerMinute(
  bookId: number,
): Promise<number | null> {
  const MIN_PAGES = 10;
  const pace = async (where: string, params: number[]) => {
    const row = await queryFirst<{
      pages: number | null;
      minutes: number | null;
    }>(
      `SELECT SUM(pages_read) as pages, SUM(minutes_read) as minutes
       FROM reading_sessions WHERE pages_read > 0 ${where}`,
      params,
    );
    return row && (row.pages ?? 0) >= MIN_PAGES && (row.minutes ?? 0) > 0
      ? row.pages! / row.minutes!
      : null;
  };
  return (await pace("AND book_id = ?", [bookId])) ?? (await pace("", []));
}

/** Average minutes read per day over the last `days` days (including today) */
export async function getAverageMinutesPerDay(
  days: number = 14,
): Promise<number> {
  const since = addDaysToDateString(getTodayDateString(), -(days - 1));
  const row = await queryFirst<{ total: number | null }>(
    "SELECT SUM(minutes_read) as total FROM reading_sessions WHERE date >= ?",
    [since],
  );
  return (row?.total ?? 0) / days;
}
