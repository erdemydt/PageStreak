import { useCallback, useMemo, useState } from "react";
import { EnhancedBook, queryAll, queryFirst } from "../db/db";
import type { UserPreferences } from "../types/database";
import {
    getTodayReadingMinutes,
    initializeReadingSessions,
} from "../utils/readingProgress";

export const useReadingStats = () => {
  const [books, setBooks] = useState<EnhancedBook[]>([]);
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadTodayProgress = useCallback(async () => {
    try {
      const minutes = await getTodayReadingMinutes();
      setTodayMinutes(minutes);
    } catch (error) {
      console.error("Error loading today progress:", error);
      setTodayMinutes(0);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const user = await queryFirst<UserPreferences>(
        "SELECT * FROM user_preferences WHERE id = 1",
      );
      setUserPreferences(user);

      await loadTodayProgress();

      try {
        const enhancedBooks = await queryAll<EnhancedBook>(
          "SELECT * FROM enhanced_books ORDER BY date_added DESC",
        );
        setBooks(enhancedBooks);
      } catch {
        try {
          const regularBooks = await queryAll<{
            id: number;
            name: string;
            author: string;
            page: number;
          }>("SELECT * FROM books ORDER BY id DESC");

          const mappedBooks: EnhancedBook[] = regularBooks.map((book) => ({
            ...book,
            reading_status: "read" as const,
            date_added: new Date().toISOString(),
            current_page: book.page,
          }));
          setBooks(mappedBooks);
        } catch {
          console.log("No books table found");
          setBooks([]);
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  }, [loadTodayProgress]);

  const initializeStats = useCallback(async () => {
    await initializeReadingSessions();
    await loadData();
  }, [loadData]);

  const handleReadingLoggerSuccess = useCallback(async () => {
    await loadTodayProgress();
    await loadData();
    setRefreshTrigger((prev) => prev + 1);
  }, [loadData, loadTodayProgress]);

  const booksRead = useMemo(
    () => books.filter((book) => book.reading_status === "read").length,
    [books],
  );
  const currentlyReading = useMemo(
    () =>
      books.filter((book) => book.reading_status === "currently_reading")
        .length,
    [books],
  );
  const wantToRead = useMemo(
    () => books.filter((book) => book.reading_status === "want_to_read").length,
    [books],
  );
  const yearlyGoal = userPreferences?.yearly_book_goal || 0;
  const progressPercentage =
    yearlyGoal > 0 ? Math.min((booksRead / yearlyGoal) * 100, 100) : 0;
  const currentBook =
    books.find((book) => book.reading_status === "currently_reading") ||
    books[0] ||
    null;

  return {
    books,
    userPreferences,
    todayMinutes,
    refreshTrigger,
    booksRead,
    currentlyReading,
    wantToRead,
    yearlyGoal,
    progressPercentage,
    currentBook,
    loadData,
    initializeStats,
    handleReadingLoggerSuccess,
  };
};
