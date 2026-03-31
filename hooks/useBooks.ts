import { useCallback, useMemo, useState } from "react";
import type { BookStatus } from "../components/BookStatusModal";
import { EnhancedBook, queryAll } from "../db/db";
import { getBookReadingTime } from "../utils/readingProgress";

export type ListedBook = EnhancedBook & {
  reading_time?: number;
};

export type BookFilterStatus = BookStatus | "all";

type StatusCounts = Record<BookStatus, number>;

type UseBooksOptions = {
  onLoadingChange?: (isLoading: boolean) => void;
  onLoadError?: (message: string) => void;
  loadErrorMessage?: string;
};

const DEFAULT_STATUS_COUNTS: StatusCounts = {
  want_to_read: 0,
  currently_reading: 0,
  read: 0,
};

export const useBooks = ({
  onLoadingChange,
  onLoadError,
  loadErrorMessage = "Failed to load books",
}: UseBooksOptions = {}) => {
  const [books, setBooks] = useState<ListedBook[]>([]);
  const [allBooksCount, setAllBooksCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>(
    DEFAULT_STATUS_COUNTS,
  );
  const [filterStatus, setFilterStatus] = useState<BookFilterStatus>("all");

  const loadBooks = useCallback(async () => {
    onLoadingChange?.(true);

    try {
      const totalResult = await queryAll<{ total: number }>(
        "SELECT COUNT(*) as total FROM enhanced_books",
      );
      const totalCount = totalResult[0]?.total || 0;
      setAllBooksCount(totalCount);

      const statusCountsResult = await queryAll<{
        reading_status: string;
        count: number;
      }>(`
        SELECT reading_status, COUNT(*) as count
        FROM enhanced_books
        GROUP BY reading_status
      `);

      const counts: StatusCounts = {
        want_to_read: 0,
        currently_reading: 0,
        read: 0,
      };
      statusCountsResult.forEach((row) => {
        if (row.reading_status in counts) {
          counts[row.reading_status as BookStatus] = row.count;
        }
      });
      setStatusCounts(counts);

      const loadedBooks = await queryAll<EnhancedBook>(`
        SELECT * FROM enhanced_books
        ORDER BY
          CASE WHEN reading_status = 'currently_reading' THEN 1
               WHEN reading_status = 'want_to_read' THEN 2
               WHEN reading_status = 'read' THEN 3
               ELSE 4 END,
          date_added DESC
        LIMIT 10
      `);

      const booksWithReadingTime = await Promise.all(
        loadedBooks.map(async (book) => {
          const readingTime = await getBookReadingTime(book.id);
          return { ...book, reading_time: readingTime };
        }),
      );

      setBooks(booksWithReadingTime);
    } catch (error) {
      onLoadError?.(loadErrorMessage);
      console.error("Load books error:", error);
    } finally {
      onLoadingChange?.(false);
    }
  }, [loadErrorMessage, onLoadError, onLoadingChange]);

  const filteredBooks = useMemo(() => {
    if (filterStatus === "all") {
      return books;
    }

    return books.filter((book) => book.reading_status === filterStatus);
  }, [books, filterStatus]);

  const getStatusCount = useCallback(
    (status: BookStatus) => statusCounts[status] || 0,
    [statusCounts],
  );

  return {
    books,
    allBooksCount,
    statusCounts,
    filterStatus,
    setFilterStatus,
    filteredBooks,
    getStatusCount,
    loadBooks,
  };
};
