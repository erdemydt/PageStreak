import { TFunction } from "i18next";
import { execute } from "../db/db";
import { COLORS } from "../themes/colors";

export type ReadingStatus = "want_to_read" | "currently_reading" | "read";

export function getStatusColor(status?: string): string {
  if (status === "currently_reading") return COLORS.status.currently_reading;
  if (status === "read") return COLORS.status.read;
  if (status === "want_to_read") return COLORS.status.want_to_read;
  return COLORS.status.unknown;
}

export function getStatusText(t: TFunction, status?: string): string {
  if (status === "currently_reading")
    return t("components.bookCard.currentlyReading");
  if (status === "read") return t("components.bookCard.read");
  if (status === "want_to_read") return t("components.bookCard.wantToRead");
  return t("components.bookCard.unknown");
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
}

/**
 * Delete a book together with its reading sessions
 */
export async function deleteBookWithSessions(bookId: number): Promise<void> {
  await execute("DELETE FROM reading_sessions WHERE book_id = ?", [bookId]);
  await execute("DELETE FROM enhanced_books WHERE id = ?", [bookId]);
}
