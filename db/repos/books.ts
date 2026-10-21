import type { ReadingStatus } from "../../utils/bookStatus";
import { syncBookCurrentPageFromSessions } from "../../utils/readingProgress";
import { EnhancedBook, execute, queryAll } from "../db";

/**
 * All writes to enhanced_books go through this module so that status and
 * date fields stay consistent. See CLAUDE.md "Domain rules".
 */

export type BookWithStats = EnhancedBook & {
  /** Total minutes across all sessions */
  reading_time: number;
  /** SUM(pages_read) across sessions; 0 when no session recorded pages */
  pages_from_sessions: number;
};

const STATUS_ORDER = `CASE WHEN b.reading_status = 'currently_reading' THEN 1
       WHEN b.reading_status = 'want_to_read' THEN 2
       WHEN b.reading_status = 'read' THEN 3
       ELSE 4 END,`;

export type NewBook = {
  name: string;
  author: string;
  page: number;
  isbn?: string | null;
  cover_id?: number | null;
  cover_url?: string | null;
  first_publish_year?: number | null;
  publisher?: string | null;
  language?: string | null;
  subjects?: string | null;
  open_library_key?: string | null;
  rating?: number | null;
};

/**
 * Insert a book with the given status. currently_reading sets date_started,
 * read sets date_finished and pins current_page to the full page count.
 */
export async function addBook(
  book: NewBook,
  status: ReadingStatus,
): Promise<number> {
  const now = new Date().toISOString();
  const result = await execute(
    `INSERT INTO enhanced_books (
       name, author, page, isbn, cover_id, cover_url, first_publish_year,
       publisher, language, subjects, open_library_key, rating,
       reading_status, date_added, date_started, date_finished, current_page
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      book.name,
      book.author,
      book.page,
      book.isbn ?? null,
      book.cover_id ?? null,
      book.cover_url ?? null,
      book.first_publish_year ?? null,
      book.publisher ?? null,
      book.language ?? "eng",
      book.subjects ?? null,
      book.open_library_key ?? null,
      book.rating ?? null,
      status,
      now,
      status === "currently_reading" ? now : null,
      status === "read" ? now : null,
      status === "read" ? book.page : 0,
    ],
  );
  return result.lastInsertRowId;
}

/**
 * Books with their session aggregates in a single query (avoids one query
 * per book). order "status" (default): currently reading -> want to read ->
 * read, newest first within each. order "recent": newest first.
 */
export async function listBooksWithStats(
  options: {
    status?: ReadingStatus;
    limit?: number;
    order?: "status" | "recent";
  } = {},
): Promise<BookWithStats[]> {
  const params: (string | number)[] = [];
  let where = "";
  if (options.status) {
    where = "WHERE b.reading_status = ?";
    params.push(options.status);
  }
  let limit = "";
  if (options.limit) {
    limit = "LIMIT ?";
    params.push(options.limit);
  }

  return queryAll<BookWithStats>(
    `SELECT b.*,
            COALESCE(SUM(s.minutes_read), 0) AS reading_time,
            COALESCE(SUM(s.pages_read), 0) AS pages_from_sessions
     FROM enhanced_books b
     LEFT JOIN reading_sessions s ON s.book_id = b.id
     ${where}
     GROUP BY b.id
     ORDER BY ${options.order === "recent" ? "" : STATUS_ORDER} b.date_added DESC
     ${limit}`,
    params,
  );
}

/**
 * Change a book's reading status, keeping the date fields consistent:
 * - currently_reading: sets date_started unless the book was already being read
 * - read: sets date_finished
 * - anything else: clears date_finished
 */
export async function updateBookStatus(
  bookId: number,
  newStatus: ReadingStatus,
): Promise<void> {
  const now = new Date().toISOString();

  if (newStatus === "currently_reading") {
    await execute(
      `UPDATE enhanced_books SET
         date_started = CASE
           WHEN reading_status = 'currently_reading' AND date_started IS NOT NULL THEN date_started
           ELSE ?
         END,
         date_finished = NULL,
         reading_status = ?
       WHERE id = ?`,
      [now, newStatus, bookId],
    );
  } else if (newStatus === "read") {
    await execute(
      "UPDATE enhanced_books SET reading_status = ?, date_finished = ? WHERE id = ?",
      [newStatus, now, bookId],
    );
  } else {
    await execute(
      "UPDATE enhanced_books SET reading_status = ?, date_finished = NULL WHERE id = ?",
      [newStatus, bookId],
    );
  }

  // Re-derive current_page for the new status: pinned to the full count when
  // read, otherwise from sessions (a re-read starts from its logged pages,
  // not from the 100% a finished book carries)
  await syncBookCurrentPageFromSessions(bookId);
}

/**
 * Delete a book together with its reading sessions
 */
export async function deleteBookWithSessions(bookId: number): Promise<void> {
  await execute("DELETE FROM reading_sessions WHERE book_id = ?", [bookId]);
  await execute("DELETE FROM enhanced_books WHERE id = ?", [bookId]);
}
