import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Dimensions,
    findNodeHandle,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { EnhancedBook, execute, queryAll } from '../db/db';
import NotificationService from '../services/notificationService';
import { getTodayDateString } from '../utils/dateUtils';
import { getEnhancedBookProgress, syncBookCurrentPageFromSessions } from '../utils/readingProgress';


interface ReadingTimeLoggerProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const { width: screenWidth } = Dimensions.get('window');



export default function ReadingTimeLogger({ visible, onClose, onSuccess }: ReadingTimeLoggerProps) {
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState('');
  const [pages, setPages] = useState('');
  const [selectedBook, setSelectedBook] = useState<EnhancedBook | null>(null);
  const [currentlyReadingBooks, setCurrentlyReadingBooks] = useState<EnhancedBook[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [remainingPages, setRemainingPages] = useState<number>(0);
  const [finishBook, setFinishBook] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCurrentlyReadingBooks();
    }
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
      const progress = await getEnhancedBookProgress(selectedBook.id, selectedBook.page, selectedBook.current_page || 0);
      const remaining = selectedBook.page - progress.pagesRead;
      setRemainingPages(Math.max(0, remaining));
    } catch (error) {
      console.error('Error calculating remaining pages:', error);
      setRemainingPages(selectedBook.page - (selectedBook.current_page || 0));
    }
  };

  const loadCurrentlyReadingBooks = async () => {
    try {
      const books = await queryAll<EnhancedBook>(
        `SELECT * FROM enhanced_books 
         WHERE reading_status = 'currently_reading' 
         ORDER BY date_started DESC, date_added DESC`
      );
      setCurrentlyReadingBooks(books);

      // Auto-select the first book if there's only one
      if (books.length === 1) {
        setSelectedBook(books[0]);
      }
    } catch (error) {
      console.error('Error loading currently reading books:', error);
    }
  };

  const handleSubmit = async () => {
    if (!minutes.trim() || isNaN(Number(minutes)) || Number(minutes) <= 0) {
      Alert.alert(t('components.readingTimeLogger.invalidInput'), t('components.readingTimeLogger.enterValidMinutes'));
      return;
    }

    if (!selectedBook) {
      Alert.alert(t('components.readingTimeLogger.selectBook'), t('components.readingTimeLogger.pleaseSelectBook'));
      return;
    }

    // Validate pages if provided
    if (pages.trim() && (isNaN(Number(pages)) || Number(pages) <= 0)) {
      Alert.alert(t('components.readingTimeLogger.invalidInput'), t('components.readingTimeLogger.enterValidPages'));
      return;
    }

    // Validate pages don't exceed remaining pages
    if (pages.trim() && Number(pages) > remainingPages) {
      Alert.alert(
        t('components.readingTimeLogger.tooManyPages'), 
        t('components.readingTimeLogger.tooManyPagesMessage', { 
          pages: Number(pages), 
          remaining: remainingPages,
          bookName: selectedBook.name 
        })
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
        [selectedBook.id, Number(minutes), pagesRead, today, notes.trim() || null]
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
          [today, selectedBook.id]
        );
      }

      // Check if daily goal is met and update notification schedule
      await NotificationService.checkAndScheduleNotification();

      // Reset form
      setMinutes('');
      setPages('');
      setSelectedBook(currentlyReadingBooks.length === 1 ? currentlyReadingBooks[0] : null);
      setNotes('');
      setFinishBook(false);

      onSuccess();
      onClose();

      const successMessage = finishBook
        ? `Successfully finished "${selectedBook.name}"! 🎉`
        : pagesRead 
        ? `Successfully logged ${minutes} minutes and ${pagesRead} pages for "${selectedBook.name}"!`
        : `Successfully logged ${minutes} minutes for "${selectedBook.name}"!`;

      Alert.alert(
        t('components.readingTimeLogger.success'),
        successMessage
      );
    } catch (error) {
      console.error('Error logging reading time:', error);
      Alert.alert(t('components.readingTimeLogger.error'), t('components.readingTimeLogger.failedToLog'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMinutes('');
    setPages('');
    setSelectedBook(currentlyReadingBooks.length === 1 ? currentlyReadingBooks[0] : null);
    setNotes('');
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>

          <Text style={styles.title}>{t('components.readingTimeLogger.title')}</Text>

        </View>

        <KeyboardAwareScrollView style={styles.content}
          showsVerticalScrollIndicator={false}
          enableAutomaticScroll={true}
          extraScrollHeight={30} keyboardOpeningTime={0} ref={scrollRef}>
          {/* Book Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('components.readingTimeLogger.whichBook')}</Text>
            {currentlyReadingBooks.length === 0 ? (
              <View style={styles.noBooks}>
                <Text style={styles.noBooksText}>
                  {t('components.readingTimeLogger.noBooksFound')}
                </Text>
              </View>
            ) : (
              <View style={styles.booksList}>
                {currentlyReadingBooks.map((book) => (
                  <TouchableOpacity
                    key={book.id}
                    style={[
                      styles.bookOption,
                      selectedBook?.id === book.id && styles.bookOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedBook(book);
                      setPages(''); // Clear pages when switching books
                      setFinishBook(false); // Reset finish book toggle
                    }}
                  >
                    <View style={styles.bookInfo}>
                      <Text style={[
                        styles.bookTitle,
                        selectedBook?.id === book.id && styles.bookTitleSelected
                      ]}>
                        {book.name}
                      </Text>
                      <Text style={[
                        styles.bookAuthor,
                        selectedBook?.id === book.id && styles.bookAuthorSelected
                      ]}>
                        {t('components.bookCard.by')} {book.author}
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
            <Text style={styles.sectionTitle}>{t('components.readingTimeLogger.howManyMinutes')}</Text>

            {/* Quick Time Buttons */}
            <View style={styles.quickTimeContainer}>
              {quickTimeButtons.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.quickTimeButton,
                    minutes === time.toString() && styles.quickTimeButtonSelected
                  ]}
                  onPress={() => setMinutes(time.toString())}
                >
                  <Text style={[
                    styles.quickTimeText,
                    minutes === time.toString() && styles.quickTimeTextSelected
                  ]}>
                    {time} {t('components.readingTimeLogger.minutesShort')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Input */}
            <View style={styles.customTimeContainer}>
              <TextInput
                style={styles.timeInput}
                placeholder={t('components.readingTimeLogger.enterCustomMinutes')}
                placeholderTextColor="#94A3B8"
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="numeric"
                returnKeyType="next"
              />
              <Text style={styles.minutesLabel}>{t('components.readingTimeLogger.minutes')}</Text>
            </View>
          </View>

          {/* Pages Input (Optional) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('components.readingTimeLogger.pagesRead')}</Text>
              <View style={styles.optionalBadge}>
                <Text style={styles.optionalText}>{t('components.readingTimeLogger.optional')}</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>
              {t('components.readingTimeLogger.trackPagesDescription')}
            </Text>
            
            {selectedBook && (
              <View style={styles.remainingPagesInfo}>
                <Text style={styles.remainingPagesText}>
                  {t('components.readingTimeLogger.remainingPages', { remaining: remainingPages, total: selectedBook.page })}
                </Text>
              </View>
            )}

            {/* Quick Page Buttons */}
            {selectedBook && remainingPages > 0 && (
              <View style={styles.quickPagesContainer}>
                {quickPageButtons.filter(pageCount => pageCount <= remainingPages).map((pageCount) => (
                  <TouchableOpacity
                    key={pageCount}
                    style={[
                      styles.quickPageButton,
                      pages === pageCount.toString() && styles.quickPageButtonSelected
                    ]}
                    onPress={() => setPages(pageCount.toString())}
                  >
                    <Text style={[
                      styles.quickPageText,
                      pages === pageCount.toString() && styles.quickPageTextSelected
                    ]}>
                      {pageCount} {t('components.readingTimeLogger.pagesShort')}
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
                placeholder={selectedBook ? t('components.readingTimeLogger.enterPagesPlaceholder', { max: remainingPages }) : t('components.readingTimeLogger.selectBookFirst')}
                placeholderTextColor="#94A3B8"
                value={pages}
                onChangeText={setPages}
                keyboardType="numeric"
                returnKeyType="next"
                editable={!!selectedBook && remainingPages > 0}
              />
              {pages.trim() && (
                <TouchableOpacity 
                  style={styles.clearPagesButton}
                  onPress={() => setPages('')}
                >
                  <Text style={styles.clearPagesText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {selectedBook && pages.trim() && !isNaN(Number(pages)) && Number(pages) > 0 && Number(pages) <= remainingPages && (
              <View style={styles.progressPreview}>
                <Text style={styles.progressPreviewText}>
                  {t('components.readingTimeLogger.progressPreview', { 
                    pages: Number(pages), 
                    bookName: selectedBook.name, 
                    total: selectedBook.page 
                  })}
                </Text>
              </View>
            )}

            {pages.trim() && Number(pages) > remainingPages && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  {t('components.readingTimeLogger.tooManyPagesWarning', { remaining: remainingPages })}
                </Text>
              </View>
            )}
          </View>

          {/* Finish Book Toggle */}
          {selectedBook && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('components.readingTimeLogger.finishBook')}</Text>
              <Text style={styles.sectionSubtitle}>
                {t('components.readingTimeLogger.finishBookDescription')}
              </Text>
              <TouchableOpacity
                style={[
                  styles.finishBookToggle,
                  finishBook && styles.finishBookToggleActive
                ]}
                onPress={() => setFinishBook(!finishBook)}
              >
                <View style={[
                  styles.finishBookCheckbox,
                  finishBook && styles.finishBookCheckboxActive
                ]}>
                  {finishBook && (
                    <Text style={styles.finishBookCheckmark}>✓</Text>
                  )}
                </View>
                <View style={styles.finishBookTextContainer}>
                  <Text style={[
                    styles.finishBookText,
                    finishBook && styles.finishBookTextActive
                  ]}>
                    {t('components.readingTimeLogger.markAsFinished', { bookName: selectedBook.name })}
                  </Text>
                  {finishBook && (
                    <Text style={styles.finishBookSubtext}>
                      {t('components.readingTimeLogger.finishBookSubtext')}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Notes (Optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('components.readingTimeLogger.notesOptional')}</Text>
            <TextInput
              style={styles.notesInput}
              placeholder={t('components.readingTimeLogger.notesPlaceholder')}
              placeholderTextColor="#94A3B8"
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
              <Text style={styles.cancelButtonText}>{t('components.readingTimeLogger.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? t('components.readingTimeLogger.saving') : t('components.readingTimeLogger.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  actionButonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,

    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
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
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  noBooks: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  noBooksText: {
    color: '#92400E',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  booksList: {
    gap: 8,
  },
  bookOption: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookOptionSelected: {
    borderColor: '#6C63FF',
    backgroundColor: '#F8F7FF',
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  bookTitleSelected: {
    color: '#6C63FF',
  },
  bookAuthor: {
    fontSize: 14,
    color: '#64748B',
  },
  bookAuthorSelected: {
    color: '#8B7AFF',
  },
  checkmark: {
    fontSize: 18,
    color: '#6C63FF',
    fontWeight: 'bold',
  },
  quickTimeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickTimeButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    minWidth: (screenWidth - 40 - 16) / 3, // 3 buttons per row with gaps
  },
  quickTimeButtonSelected: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  quickTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  quickTimeTextSelected: {
    color: '#FFFFFF',
  },
  customTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  timeInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1E293B',
  },
  minutesLabel: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  // Pages input styles
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionalBadge: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  optionalText: {
    fontSize: 10,
    color: '#0EA5E9',
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  pagesInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
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
    color: '#1E293B',
  },
  clearPagesButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clearPagesText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 'bold',
  },
  progressPreview: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  progressPreviewText: {
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 16,
    textAlign: 'center',
  },
  // Remaining pages info
  remainingPagesInfo: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  remainingPagesText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '500',
    textAlign: 'center',
  },
  // Quick pages buttons
  quickPagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickPageButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    minWidth: (screenWidth - 40 - 16) / 3,
  },
  quickPageButtonSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  quickPageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  quickPageTextSelected: {
    color: '#FFFFFF',
  },
  // Warning styles
  warningContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  warningText: {
    fontSize: 12,
    color: '#DC2626',
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Finish book styles
  finishBookToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  finishBookToggleActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  finishBookCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  finishBookCheckboxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  finishBookCheckmark: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  finishBookTextContainer: {
    flex: 1,
  },
  finishBookText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  finishBookTextActive: {
    color: '#059669',
  },
  finishBookSubtext: {
    fontSize: 12,
    color: '#059669',
    lineHeight: 16,
  },
});
