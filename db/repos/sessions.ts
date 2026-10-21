import type { ReadingSession } from "../../types/models";
import { emitDataChange } from "../../utils/dataEvents";
import { getTodayDateString } from "../../utils/dateUtils";
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
  changes: { minutes: number; notes?: string | null; pages?: number | null },
): Promise<void> {
  const session = await getSession(id);
  if (!session) throw new Error("Session not found");

  await execute(
    "UPDATE reading_sessions SET minutes_read = ?, notes = ?, pages_read = ? WHERE id = ?",
    [changes.minutes, changes.notes || null, changes.pages || null, id],
  );
  // Always re-derive: clearing the pages field must lower progress too
  await syncBookCurrentPageFromSessions(session.book_id);
  emitDataChange("sessions", "books");
}

export async function deleteSession(id: number): Promise<void> {
  const session = await getSession(id);
  if (!session) throw new Error("Session not found");

  await execute("DELETE FROM reading_sessions WHERE id = ?", [id]);
  await syncBookCurrentPageFromSessions(session.book_id);
  emitDataChange("sessions", "books");
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
