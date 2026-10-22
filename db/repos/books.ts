import type { ReadingStatus } from "../../utils/bookStatus";
import { syncBookCurrentPageFromSessions } from "../../utils/readingProgress";
import { emitDataChange } from "../../utils/dataEvents";
import { EnhancedBook, execute, queryAll, queryFirst } from "../db";

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

const ORDER_CLAUSES = {
  status: `${STATUS_ORDER} b.date_added DESC`,
  recent: "b.date_added DESC",
  started: "b.date_started DESC, b.date_added DESC",
  // Most recently read first (latest session), then books never logged, newest started first
  // datetime() normalizes both stored created_at formats (SQLite's and ISO with Z)
  active: `MAX(s.date) IS NULL, MAX(s.date) DESC, MAX(datetime(s.created_at)) DESC,
           b.date_started DESC, b.date_added DESC`,
} as const;

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
  emitDataChange("books");
  return result.lastInsertRowId;
}

/**
 * Books with their session aggregates in a single query (avoids one query
 * per book). order "status" (default): currently reading -> want to read ->
 * read, newest first within each. "recent": newest first. "started": most
 * recently started first. "active": most recently read (by session) first.
 */
export async function listBooksWithStats(
  options: {
    status?: ReadingStatus;
    limit?: number;
    order?: keyof typeof ORDER_CLAUSES;
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
     ORDER BY ${ORDER_CLAUSES[options.order ?? "status"]}
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
  emitDataChange("books");
}

/** A book's status and its dates, as saved before a change (for Undo) */
export type BookStatusSnapshot = Pick<
  EnhancedBook,
  "reading_status" | "date_started" | "date_finished"
>;

/** Put back a status exactly as it was, dates included (Undo of updateBookStatus) */
export async function restoreBookStatus(
  bookId: number,
  snapshot: BookStatusSnapshot,
): Promise<void> {
  await execute(
    "UPDATE enhanced_books SET reading_status = ?, date_started = ?, date_finished = ? WHERE id = ?",
    [
      snapshot.reading_status,
      snapshot.date_started ?? null,
      snapshot.date_finished ?? null,
      bookId,
    ],
  );
  await syncBookCurrentPageFromSessions(bookId);
  emitDataChange("books");
}

/**
 * Delete a book together with its reading sessions
 */
export async function deleteBookWithSessions(bookId: number): Promise<void> {
  await execute("DELETE FROM reading_sessions WHERE book_id = ?", [bookId]);
  await execute("DELETE FROM enhanced_books WHERE id = ?", [bookId]);
  emitDataChange("books", "sessions");
}

/** An existing book with this Open Library key (to warn about duplicate adds) */
export async function findBookByOpenLibraryKey(
  key: string,
): Promise<EnhancedBook | null> {
  return queryFirst<EnhancedBook>(
    "SELECT * FROM enhanced_books WHERE open_library_key = ?",
    [key],
  );
}

export async function getBook(bookId: number): Promise<EnhancedBook | null> {
  return queryFirst<EnhancedBook>("SELECT * FROM enhanced_books WHERE id = ?", [
    bookId,
  ]);
}

/** Set the total page count; current_page is re-capped to it */
export async function setPageCount(
  bookId: number,
  pageCount: number,
): Promise<void> {
  await execute("UPDATE enhanced_books SET page = ? WHERE id = ?", [
    pageCount,
    bookId,
  ]);
  await syncBookCurrentPageFromSessions(bookId);
  emitDataChange("books");
}

/** Total number of books and the count per reading status */
export async function countBooksByStatus(): Promise<
  { total: number } & Record<ReadingStatus, number>
> {
  const rows = await queryAll<{ reading_status: string; count: number }>(
    "SELECT reading_status, COUNT(*) as count FROM enhanced_books GROUP BY reading_status",
  );
  const counts = { total: 0, want_to_read: 0, currently_reading: 0, read: 0 };
  for (const row of rows) {
    counts.total += row.count;
    if (row.reading_status in counts) {
      counts[row.reading_status as ReadingStatus] = row.count;
    }
  }
  return counts;
}
