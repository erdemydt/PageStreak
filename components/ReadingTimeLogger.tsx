import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { EnhancedBook } from "../db/db";
import { listBooksWithStats, updateBookStatus } from "../db/repos/books";
import { logSession } from "../db/repos/sessions";
import { getTodayDateString } from "../utils/dateUtils";
import SessionDatePicker from "./SessionDatePicker";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import { SPACING } from "../themes/spacing";
import { FONTS, TYPE } from "../themes/typography";
import { getEnhancedBookProgress } from "../utils/readingProgress";
import { showToast } from "../utils/toast";
import {
  FieldGroup,
  MinutesField,
  NotesField,
  PagesField,
} from "./session/SessionFields";
import BookCover from "./ui/BookCover";
import Button from "./ui/Button";
import Sheet from "./ui/Sheet";

interface ReadingTimeLoggerProps {
  visible: boolean;
  onClose: () => void;
  /** Optional: listeners via useFocusRefresh already reload on save */
  onSuccess?: () => void;
  /** The session also marked its book as read */
  onFinishedBook?: (bookId: number) => void;
  /** Pre-fill from the reading timer */
  initialMinutes?: number;
  initialBookId?: number;
  /** YYYY-MM-DD; defaults to today */
  initialDate?: string;
}

export default function ReadingTimeLogger({
  visible,
  onClose,
  onSuccess,
  onFinishedBook,
  initialMinutes,
  initialBookId,
  initialDate,
}: ReadingTimeLoggerProps) {
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState("");
  const [pages, setPages] = useState("");
  const [selectedBook, setSelectedBook] = useState<EnhancedBook | null>(null);
  const [currentlyReadingBooks, setCurrentlyReadingBooks] = useState<
    EnhancedBook[]
  >([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [remainingPages, setRemainingPages] = useState<number>(0);
  const [finishBook, setFinishBook] = useState(false);
  const [sessionDate, setSessionDate] = useState(getTodayDateString());
  const [wantToReadBooks, setWantToReadBooks] = useState<EnhancedBook[]>([]);

  useEffect(() => {
    if (visible) {
      loadCurrentlyReadingBooks();
      // Default to today each time the logger opens (it may stay mounted past midnight)
      setSessionDate(initialDate ?? getTodayDateString());
      if (initialMinutes) setMinutes(String(initialMinutes));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (selectedBook) {
      calculateRemainingPages();
    }
  }, [selectedBook]);

  const calculateRemainingPages = async () => {
    if (!selectedBook) {
      setRemainingPages(0);
      return;
    }

    try {
      const progress = await getEnhancedBookProgress(
        selectedBook.id,
        selectedBook.page,
        selectedBook.current_page || 0,
      );
      const remaining = selectedBook.page - progress.pagesRead;
      setRemainingPages(Math.max(0, remaining));
    } catch (error) {
      console.error("Error calculating remaining pages:", error);
      setRemainingPages(selectedBook.page - (selectedBook.current_page || 0));
    }
  };

  const loadCurrentlyReadingBooks = async () => {
    try {
      // Most recently read first, so the preselected book is usually the right one
      const books = await listBooksWithStats({
        status: "currently_reading",
        order: "active",
      });
      setCurrentlyReadingBooks(books);

      // Refresh the selection from the fresh list, and drop a selection that is no
      // longer being read (e.g. a book finished in the previous session) so we
      // never log time against it.
      setSelectedBook((previous) => {
        if (initialBookId !== undefined) {
          // The requested book only (the timer's, or the book page's); if it's no
          // longer being read, let the user choose rather than crediting another
          return books.find((book) => book.id === initialBookId) ?? null;
        }
        return (
          books.find((book) => book.id === previous?.id) ?? books[0] ?? null
        );
      });

      setWantToReadBooks(
        books.length === 0
          ? await listBooksWithStats({
              status: "want_to_read",
              order: "recent",
            })
          : [],
      );
    } catch (error) {
      console.error("Error loading currently reading books:", error);
    }
  };

  const startReading = async (bookId: number) => {
    try {
      await updateBookStatus(bookId, "currently_reading");
      await loadCurrentlyReadingBooks();
    } catch (error) {
      console.error("Error starting book:", error);
      Alert.alert(t("error"), t("booksPage.alert.failedUpdate"));
    }
  };

  const handleSubmit = async () => {
    if (!minutes.trim() || isNaN(Number(minutes)) || Number(minutes) <= 0) {
      Alert.alert(
        t("components.readingTimeLogger.invalidInput"),
        t("components.readingTimeLogger.enterValidMinutes"),
      );
      return;
    }

    if (!selectedBook) {
      Alert.alert(
        t("components.readingTimeLogger.selectBook"),
        t("components.readingTimeLogger.pleaseSelectBook"),
      );
      return;
    }

    // Validate pages if provided
    if (pages.trim() && (isNaN(Number(pages)) || Number(pages) <= 0)) {
      Alert.alert(
        t("components.readingTimeLogger.invalidInput"),
        t("components.readingTimeLogger.enterValidPages"),
      );
      return;
    }

    // Validate pages don't exceed remaining pages
    if (pages.trim() && Number(pages) > remainingPages) {
      Alert.alert(
        t("components.readingTimeLogger.tooManyPages"),
        t("components.readingTimeLogger.tooManyPagesMessage", {
          pages: Number(pages),
          remaining: remainingPages,
          bookName: selectedBook.name,
        }),
      );
      return;
    }

    setLoading(true);
    try {
      const pagesRead = pages.trim() ? Number(pages) : null;

      await logSession({
        bookId: selectedBook.id,
        minutes: Number(minutes),
        pages: pagesRead,
        notes: notes.trim() || null,
        date: sessionDate,
        finishBook,
      });

      // The session is saved: a reminder problem must not report "failed to log"
      // (the user would retry and log it twice)
      try {
        await NotificationService.checkAndScheduleNotification();
      } catch (error) {
        console.error("Error rescheduling the reminder:", error);
      }

      // Reset form
      setMinutes("");
      setPages("");
      setNotes("");
      setFinishBook(false);
      setSessionDate(getTodayDateString());

      onSuccess?.();
      onClose();
      if (finishBook) onFinishedBook?.(selectedBook.id);

      const successMessage = finishBook
        ? t("components.readingTimeLogger.finishedBook", {
            bookName: selectedBook.name,
          })
        : pagesRead
          ? t("components.readingTimeLogger.loggedMinutesAndPages", {
              minutes,
              pages: pagesRead,
              bookName: selectedBook.name,
            })
          : t("components.readingTimeLogger.loggedMinutes", {
              minutes,
              bookName: selectedBook.name,
            });

      // A finished book gets the finish sheet instead of a toast
      if (!finishBook) showToast({ message: successMessage });
    } catch (error) {
      console.error("Error logging reading time:", error);
      Alert.alert(
        t("components.readingTimeLogger.error"),
        t("components.readingTimeLogger.failedToLog"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setMinutes("");
    setPages("");
    setNotes("");
    setFinishBook(false);
    setSessionDate(getTodayDateString());
    onClose();
  };
  const scrollRef = useRef<ScrollView>(null);

  const selectBook = (book: EnhancedBook) => {
    setSelectedBook(book);
    setPages(""); // Pages are per book
    setFinishBook(false);
  };

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title={t("components.readingTimeLogger.title")}
      dismissible={!loading}
      scrollRef={scrollRef}
      footer={
        <>
          <Button
            title={t("components.readingTimeLogger.cancel")}
            variant="secondary"
            onPress={handleClose}
            disabled={loading}
          />
          <Button
            title={t("components.readingTimeLogger.save")}
            onPress={handleSubmit}
            loading={loading}
            grow
          />
        </>
      }
    >
      <FieldGroup label={t("components.readingTimeLogger.whichBook")}>
        {currentlyReadingBooks.length === 0 ? (
          <View style={styles.noBooks}>
            <Text style={styles.noBooksText}>
              {t("components.readingTimeLogger.noBooksFound")}
            </Text>
            {/* Not a dead end: start one of the want-to-read books here */}
            {wantToReadBooks.length > 0 && (
              <>
                <Text style={styles.hint}>
                  {t("components.readingTimeLogger.startReadingHint")}
                </Text>
                {wantToReadBooks.slice(0, 5).map((book) => (
                  <View key={book.id} style={styles.startRow}>
                    <Text style={styles.startTitle} numberOfLines={1}>
                      {book.name}
                    </Text>
                    <Button
                      title={t("components.readingTimeLogger.startReading")}
                      variant="secondary"
                      compact
                      onPress={() => startReading(book.id)}
                    />
                  </View>
                ))}
              </>
            )}
          </View>
        ) : (
          currentlyReadingBooks.map((book) => {
            const selected = selectedBook?.id === book.id;
            return (
              <Pressable
                key={book.id}
                style={styles.bookRow}
                onPress={() => selectBook(book)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${book.name}, ${book.author}`}
              >
                <BookCover
                  uri={book.cover_url}
                  title={book.name}
                  author={book.author}
                  width={30}
                />
                <View style={styles.bookText}>
                  <Text style={styles.bookTitle} numberOfLines={1}>
                    {book.name}
                  </Text>
                  <Text style={styles.bookAuthor} numberOfLines={1}>
                    {book.author}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={selected ? COLORS.accent.primary : COLORS.line.strong}
                />
              </Pressable>
            );
          })
        )}
      </FieldGroup>

      <FieldGroup label={t("components.sessionDate.title")}>
        <SessionDatePicker value={sessionDate} onChange={setSessionDate} />
      </FieldGroup>

      <MinutesField value={minutes} onChange={setMinutes} />

      <PagesField
        value={pages}
        onChange={setPages}
        remaining={remainingPages}
        enabled={!!selectedBook && remainingPages > 0}
        disabledHint={
          selectedBook
            ? t("components.readingTimeLogger.noPagesToLog")
            : t("components.readingTimeLogger.selectBookFirst")
        }
        total={selectedBook?.page}
      />

      {selectedBook && (
        <FieldGroup label={t("components.readingTimeLogger.finishBook")}>
          <View style={styles.finishRow}>
            <View style={styles.finishText}>
              <Text style={styles.finishTitle}>
                {t("components.readingTimeLogger.markAsFinished", {
                  bookName: selectedBook.name,
                })}
              </Text>
              <Text style={styles.hint}>
                {finishBook
                  ? t("components.readingTimeLogger.finishBookSubtext")
                  : t("components.readingTimeLogger.finishBookDescription")}
              </Text>
            </View>
            <Switch
              value={finishBook}
              onValueChange={setFinishBook}
              trackColor={{ true: COLORS.accent.primary, false: COLORS.line.strong }}
              accessibilityLabel={t("components.readingTimeLogger.finishBook")}
            />
          </View>
        </FieldGroup>
      )}

      <NotesField
        value={notes}
        onChange={setNotes}
        label={t("components.readingTimeLogger.notesOptional")}
        placeholder={t("components.readingTimeLogger.notesPlaceholder")}
        onFocus={() =>
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250)
        }
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  noBooks: {
    gap: SPACING[3],
  },
  noBooksText: TYPE.body,
  hint: TYPE.meta,
  startRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
  },
  startTitle: {
    ...TYPE.bodyStrong,
    flex: 1,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
    minHeight: 56,
  },
  bookText: {
    flex: 1,
    gap: 1,
  },
  bookTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    lineHeight: 23,
    color: COLORS.ink.primary,
  },
  bookAuthor: {
    ...TYPE.meta,
    fontFamily: FONTS.serifItalic,
    fontSize: 14,
  },
  finishRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[4],
  },
  finishText: {
    flex: 1,
    gap: 2,
  },
  finishTitle: TYPE.bodyStrong,
});
