import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Dimensions,
    findNodeHandle,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { EnhancedBook, execute, queryAll } from "../../db/db";
import notificationService from "../../services/notificationService";
import { COLORS } from "../../themes/colors";
import { getTodayDateString } from "../../utils/dateUtils";
import {
    getEnhancedBookProgress,
    syncBookCurrentPageFromSessions,
} from "../../utils/readingProgress";
import ModalShell from "../ui/ModalShell";

interface ReadingTimeLoggerProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const { width: screenWidth } = Dimensions.get("window");

export default function ReadingTimeLogger({
  visible,
  onClose,
  onSuccess,
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

  useEffect(() => {
    if (visible) {
      loadCurrentlyReadingBooks();
    }
  }, [visible]);

  const calculateRemainingPages = useCallback(async () => {
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
  }, [selectedBook]);

  useEffect(() => {
    if (selectedBook) {
      calculateRemainingPages();
    }
  }, [calculateRemainingPages, selectedBook]);

  const loadCurrentlyReadingBooks = async () => {
    try {
      const books = await queryAll<EnhancedBook>(
        `SELECT * FROM enhanced_books 
         WHERE reading_status = 'currently_reading' 
         ORDER BY date_started DESC, date_added DESC`,
      );
      setCurrentlyReadingBooks(books);

      // Auto-select the first book if there's only one
      if (books.length === 1) {
        setSelectedBook(books[0]);
      }
    } catch (error) {
      console.error("Error loading currently reading books:", error);
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
      const today = getTodayDateString(); // YYYY-MM-DD format
      const pagesRead = pages.trim() ? Number(pages) : null;

      // Insert the reading session
      await execute(
        `INSERT INTO reading_sessions (book_id, minutes_read, pages_read, date, notes) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          selectedBook.id,
          Number(minutes),
          pagesRead,
          today,
          notes.trim() || null,
        ],
      );

      // Sync the book's current_page based on cumulative pages from sessions
      if (pagesRead) {
        await syncBookCurrentPageFromSessions(selectedBook.id);
      }

      // Handle book completion if finish book is checked
      if (finishBook) {
        const today = getTodayDateString();
        await execute(
          `UPDATE enhanced_books 
           SET reading_status = 'read', 
               date_finished = ?,
               current_page = page
           WHERE id = ?`,
          [today, selectedBook.id],
        );
      }

      // Check if daily goal is met and update notification schedule
      await notificationService.checkAndScheduleNotification();

      // Reset form
      setMinutes("");
      setPages("");
      setSelectedBook(
        currentlyReadingBooks.length === 1 ? currentlyReadingBooks[0] : null,
      );
      setNotes("");
      setFinishBook(false);

      onSuccess();
      onClose();

      const successMessage = finishBook
        ? `Successfully finished "${selectedBook.name}"! 🎉`
        : pagesRead
          ? `Successfully logged ${minutes} minutes and ${pagesRead} pages for "${selectedBook.name}"!`
          : `Successfully logged ${minutes} minutes for "${selectedBook.name}"!`;

      Alert.alert(t("components.readingTimeLogger.success"), successMessage);
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
    setMinutes("");
    setPages("");
    setSelectedBook(
      currentlyReadingBooks.length === 1 ? currentlyReadingBooks[0] : null,
    );
    setNotes("");
    setFinishBook(false);
    onClose();
  };
  const notesInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const quickTimeButtons = [5, 10, 15, 30, 45, 60];
  const quickPageButtons = [5, 10, 20];

  const scrollTo = (inputRef: React.RefObject<TextInput | null>) => {
    const node = findNodeHandle(inputRef.current);
    if (node && scrollRef.current?.scrollToFocusedInput) {
      scrollRef.current.scrollToFocusedInput(node);
      // Additional offset if needed
      setTimeout(() => {
        scrollRef.current?.scrollToPosition(0, 300, true);
      }, 100);
    }
  };
  return (
    <ModalShell visible={visible} onClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t("components.readingTimeLogger.title")}
          </Text>
        </View>

        <KeyboardAwareScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          enableAutomaticScroll={true}
          extraScrollHeight={30}
          keyboardOpeningTime={0}
          ref={scrollRef}
        >
          {/* Book Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("components.readingTimeLogger.whichBook")}
            </Text>
            {currentlyReadingBooks.length === 0 ? (
              <View style={styles.noBooks}>
                <Text style={styles.noBooksText}>
                  {t("components.readingTimeLogger.noBooksFound")}
                </Text>
              </View>
            ) : (
              <View style={styles.booksList}>
                {currentlyReadingBooks.map((book) => (
                  <TouchableOpacity
                    key={book.id}
                    style={[
                      styles.bookOption,
                      selectedBook?.id === book.id && styles.bookOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedBook(book);
                      setPages(""); // Clear pages when switching books
                      setFinishBook(false); // Reset finish book toggle
                    }}
                  >
                    <View style={styles.bookInfo}>
                      <Text
                        style={[
                          styles.bookTitle,
                          selectedBook?.id === book.id &&
                            styles.bookTitleSelected,
                        ]}
                      >
                        {book.name}
                      </Text>
                      <Text
                        style={[
                          styles.bookAuthor,
                          selectedBook?.id === book.id &&
                            styles.bookAuthorSelected,
                        ]}
                      >
                        {t("components.bookCard.by")} {book.author}
                      </Text>
                    </View>
                    {selectedBook?.id === book.id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Time Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("components.readingTimeLogger.howManyMinutes")}
            </Text>

            {/* Quick Time Buttons */}
            <View style={styles.quickTimeContainer}>
              {quickTimeButtons.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.quickTimeButton,
                    minutes === time.toString() &&
                      styles.quickTimeButtonSelected,
                  ]}
                  onPress={() => setMinutes(time.toString())}
                >
                  <Text
                    style={[
                      styles.quickTimeText,
                      minutes === time.toString() &&
                        styles.quickTimeTextSelected,
                    ]}
                  >
                    {time} {t("components.readingTimeLogger.minutesShort")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Input */}
            <View style={styles.customTimeContainer}>
              <TextInput
                style={styles.timeInput}
                placeholder={t(
                  "components.readingTimeLogger.enterCustomMinutes",
                )}
                placeholderTextColor={COLORS.neutral[400]}
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="numeric"
                returnKeyType="next"
              />
              <Text style={styles.minutesLabel}>
                {t("components.readingTimeLogger.minutes")}
              </Text>
            </View>
          </View>

          {/* Pages Input (Optional) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("components.readingTimeLogger.pagesRead")}
              </Text>
              <View style={styles.optionalBadge}>
                <Text style={styles.optionalText}>
                  {t("components.readingTimeLogger.optional")}
                </Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>
              {t("components.readingTimeLogger.trackPagesDescription")}
            </Text>

            {selectedBook && (
              <View style={styles.remainingPagesInfo}>
                <Text style={styles.remainingPagesText}>
                  {t("components.readingTimeLogger.remainingPages", {
                    remaining: remainingPages,
                    total: selectedBook.page,
                  })}
                </Text>
              </View>
            )}

            {/* Quick Page Buttons */}
            {selectedBook && remainingPages > 0 && (
              <View style={styles.quickPagesContainer}>
                {quickPageButtons
                  .filter((pageCount) => pageCount <= remainingPages)
                  .map((pageCount) => (
                    <TouchableOpacity
                      key={pageCount}
                      style={[
                        styles.quickPageButton,
                        pages === pageCount.toString() &&
                          styles.quickPageButtonSelected,
                      ]}
                      onPress={() => setPages(pageCount.toString())}
                    >
                      <Text
                        style={[
                          styles.quickPageText,
                          pages === pageCount.toString() &&
                            styles.quickPageTextSelected,
                        ]}
                      >
                        {pageCount}{" "}
                        {t("components.readingTimeLogger.pagesShort")}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}

            <View style={styles.pagesInputContainer}>
              <View style={styles.pagesIconContainer}>
                <Text style={styles.pagesIcon}>📚</Text>
              </View>
              <TextInput
                style={styles.pagesInput}
                placeholder={
                  selectedBook
                    ? t("components.readingTimeLogger.enterPagesPlaceholder", {
                        max: remainingPages,
                      })
                    : t("components.readingTimeLogger.selectBookFirst")
                }
                placeholderTextColor={COLORS.neutral[400]}
                value={pages}
                onChangeText={setPages}
                keyboardType="numeric"
                returnKeyType="next"
                editable={!!selectedBook && remainingPages > 0}
              />
              {pages.trim() && (
                <TouchableOpacity
                  style={styles.clearPagesButton}
                  onPress={() => setPages("")}
                >
                  <Text style={styles.clearPagesText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {selectedBook &&
              pages.trim() &&
              !isNaN(Number(pages)) &&
              Number(pages) > 0 &&
              Number(pages) <= remainingPages && (
                <View style={styles.progressPreview}>
                  <Text style={styles.progressPreviewText}>
                    {t("components.readingTimeLogger.progressPreview", {
                      pages: Number(pages),
                      bookName: selectedBook.name,
                      total: selectedBook.page,
                    })}
                  </Text>
                </View>
              )}

            {pages.trim() && Number(pages) > remainingPages && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  {t("components.readingTimeLogger.tooManyPagesWarning", {
                    remaining: remainingPages,
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* Finish Book Toggle */}
          {selectedBook && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("components.readingTimeLogger.finishBook")}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {t("components.readingTimeLogger.finishBookDescription")}
              </Text>
              <TouchableOpacity
                style={[
                  styles.finishBookToggle,
                  finishBook && styles.finishBookToggleActive,
                ]}
                onPress={() => setFinishBook(!finishBook)}
              >
                <View
                  style={[
                    styles.finishBookCheckbox,
                    finishBook && styles.finishBookCheckboxActive,
                  ]}
                >
                  {finishBook && (
                    <Text style={styles.finishBookCheckmark}>✓</Text>
                  )}
                </View>
                <View style={styles.finishBookTextContainer}>
                  <Text
                    style={[
                      styles.finishBookText,
                      finishBook && styles.finishBookTextActive,
                    ]}
                  >
                    {t("components.readingTimeLogger.markAsFinished", {
                      bookName: selectedBook.name,
                    })}
                  </Text>
                  {finishBook && (
                    <Text style={styles.finishBookSubtext}>
                      {t("components.readingTimeLogger.finishBookSubtext")}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Notes (Optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("components.readingTimeLogger.notesOptional")}
            </Text>
            <TextInput
              style={styles.notesInput}
              placeholder={t("components.readingTimeLogger.notesPlaceholder")}
              placeholderTextColor={COLORS.neutral[400]}
              value={notes}
              ref={notesInputRef}
              onChangeText={setNotes}
              onFocus={() => {
                scrollTo(notesInputRef);
              }}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />
          </View>
          {/* Action Buttons */}
          <View style={styles.actionButonsContainer}>
            <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>
                {t("components.readingTimeLogger.cancel")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading
                  ? t("components.readingTimeLogger.saving")
                  : t("components.readingTimeLogger.save")}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
  },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
  },
  actionButonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,

    borderTopWidth: 1,
    borderTopColor: COLORS.neutral[200],
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.neutral[800],
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: COLORS.neutral[200],
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.neutral[300],
  },
  saveButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[700],
    marginBottom: 12,
  },
  noBooks: {
    backgroundColor: COLORS.state.warningSoft,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  noBooksText: {
    color: COLORS.state.warningText,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  booksList: {
    gap: 8,
  },
  bookOption: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bookOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.state.cardAccent,
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 4,
  },
  bookTitleSelected: {
    color: COLORS.primary,
  },
  bookAuthor: {
    fontSize: 14,
    color: COLORS.neutral[500],
  },
  bookAuthorSelected: {
    color: COLORS.primaryDark,
  },
  checkmark: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: "bold",
  },
  quickTimeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  quickTimeButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    minWidth: (screenWidth - 40 - 16) / 3, // 3 buttons per row with gaps
  },
  quickTimeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickTimeText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[500],
    textAlign: "center",
  },
  quickTimeTextSelected: {
    color: COLORS.white,
  },
  customTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    paddingHorizontal: 16,
  },
  timeInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: COLORS.neutral[800],
  },
  minutesLabel: {
    fontSize: 16,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  notesInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    padding: 16,
    fontSize: 16,
    color: COLORS.neutral[800],
    textAlignVertical: "top",
    minHeight: 80,
  },
  // Pages input styles
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  optionalBadge: {
    backgroundColor: COLORS.state.primarySoftAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: COLORS.state.accentCyan,
  },
  optionalText: {
    fontSize: 10,
    color: COLORS.state.accentCyan,
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.neutral[500],
    marginBottom: 12,
    lineHeight: 18,
  },
  pagesInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  pagesIconContainer: {
    marginRight: 12,
  },
  pagesIcon: {
    fontSize: 20,
  },
  pagesInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: COLORS.neutral[800],
  },
  clearPagesButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  clearPagesText: {
    fontSize: 12,
    color: COLORS.neutral[500],
    fontWeight: "bold",
  },
  progressPreview: {
    backgroundColor: COLORS.state.primarySoftAlt,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.state.accentCyan,
  },
  progressPreviewText: {
    fontSize: 12,
    color: COLORS.state.accentCyanDark,
    lineHeight: 16,
    textAlign: "center",
  },
  // Remaining pages info
  remainingPagesInfo: {
    backgroundColor: COLORS.state.primarySoftAlt,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.state.infoBorder,
  },
  remainingPagesText: {
    fontSize: 12,
    color: COLORS.state.accentCyanDark,
    fontWeight: "500",
    textAlign: "center",
  },
  // Quick pages buttons
  quickPagesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  quickPageButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    minWidth: (screenWidth - 40 - 16) / 3,
  },
  quickPageButtonSelected: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  quickPageText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.neutral[500],
    textAlign: "center",
  },
  quickPageTextSelected: {
    color: COLORS.white,
  },
  // Warning styles
  warningContainer: {
    backgroundColor: COLORS.state.dangerSoft,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.state.dangerBorder,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.state.dangerText,
    lineHeight: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  // Finish book styles
  finishBookToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    padding: 16,
  },
  finishBookToggleActive: {
    backgroundColor: COLORS.state.successSoft,
    borderColor: COLORS.success,
  },
  finishBookCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.neutral[300],
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  finishBookCheckboxActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  finishBookCheckmark: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: "bold",
  },
  finishBookTextContainer: {
    flex: 1,
  },
  finishBookText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[700],
    marginBottom: 4,
  },
  finishBookTextActive: {
    color: COLORS.state.successText,
  },
  finishBookSubtext: {
    fontSize: 12,
    color: COLORS.state.successText,
    lineHeight: 16,
  },
});
