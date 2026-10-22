import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { BookStatus } from "../components/BookStatusModal";
import { SHEET_HANDOFF_MS } from "../components/ui/Sheet";
import { useSessionSheets } from "../contexts/SessionSheetsContext";
import {
  getBook,
  restoreBookStatus,
  updateBookStatus,
} from "../db/repos/books";
import { showToast } from "../utils/toast";

type StatusBook = { id: number; reading_status?: string };

/**
 * Change a book's reading status the same way everywhere: leaving "read" asks
 * first (it clears the finish date), finishing opens the finish sheet, other
 * changes show a toast whose Undo puts the old status and dates back. Pass `fromSheet` when a sheet is still closing, so the
 * alert or finish sheet waits for it (iOS can't present over a dismissing modal).
 */
export function useBookStatusChange() {
  const { t } = useTranslation();
  const { celebrateFinish } = useSessionSheets();

  const apply = useCallback(
    async (bookId: number, status: BookStatus, fromSheet: boolean) => {
      try {
        const before = await getBook(bookId);
        await updateBookStatus(bookId, status);
        if (status === "read") {
          if (fromSheet) {
            setTimeout(() => celebrateFinish(bookId), SHEET_HANDOFF_MS);
          } else {
            celebrateFinish(bookId);
          }
        } else {
          showToast({
            message: t(
              status === "want_to_read"
                ? "booksPage.alert.movedToWantToRead"
                : "booksPage.alert.movedToReading",
            ),
            ...(before && {
              actionLabel: t("undo"),
              onAction: () => {
                restoreBookStatus(bookId, before).catch((e) =>
                  console.error("Failed to undo status change:", e),
                );
              },
            }),
          });
        }
      } catch (e) {
        console.error("Failed to update status:", e);
        Alert.alert(t("error"), t("booksPage.alert.failedUpdate"));
      }
    },
    [t, celebrateFinish],
  );

  return useCallback(
    (book: StatusBook, status: BookStatus, { fromSheet = false } = {}) => {
      if (status === book.reading_status) return;
      if (book.reading_status !== "read") {
        apply(book.id, status, fromSheet);
        return;
      }
      // Leaving "read" clears the finish date (the book drops out of the
      // year's count), so ask first
      const ask = () =>
        Alert.alert(t("bookPage.unfinishTitle"), t("bookPage.unfinishMessage"), [
          { text: t("booksPage.alert.cancel"), style: "cancel" },
          {
            text: t("bookPage.unfinishConfirm"),
            onPress: () => apply(book.id, status, false),
          },
        ]);
      if (fromSheet) setTimeout(ask, SHEET_HANDOFF_MS);
      else ask();
    },
    [t, apply],
  );
}
