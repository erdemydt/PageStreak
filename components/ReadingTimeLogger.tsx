import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { EnhancedBook, execute, queryAll } from '../db/db';
import NotificationService from '../services/notificationService';

interface ReadingTimeLoggerProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function ReadingTimeLogger({ visible, onClose, onSuccess }: ReadingTimeLoggerProps) {
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState('');
  const [selectedBook, setSelectedBook] = useState<EnhancedBook | null>(null);
  const [currentlyReadingBooks, setCurrentlyReadingBooks] = useState<EnhancedBook[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCurrentlyReadingBooks();
    }
  }, [visible]);

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

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Insert the reading session
      await execute(
        `INSERT INTO reading_sessions (book_id, minutes_read, date, notes) 
         VALUES (?, ?, ?, ?)`,
        [selectedBook.id, Number(minutes), today, notes.trim() || null]
      );

      // Check if daily goal is met and update notification schedule
      await NotificationService.checkAndScheduleNotification();

      // Reset form
      setMinutes('');
      setSelectedBook(currentlyReadingBooks.length === 1 ? currentlyReadingBooks[0] : null);
      setNotes('');
      
      onSuccess();
      onClose();
      
      Alert.alert(
        t('components.readingTimeLogger.success'), 
        t('components.readingTimeLogger.loggedMinutes', { minutes, bookName: selectedBook.name })
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
    setSelectedBook(currentlyReadingBooks.length === 1 ? currentlyReadingBooks[0] : null);
    setNotes('');
    onClose();
  };

  const quickTimeButtons = [5, 10, 15, 30, 45, 60];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>{t('components.readingTimeLogger.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('components.readingTimeLogger.title')}</Text>
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                    onPress={() => setSelectedBook(book)}
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
                    {time}m
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

          {/* Notes (Optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('components.readingTimeLogger.notesOptional')}</Text>
            <TextInput
              style={styles.notesInput}
              placeholder={t('components.readingTimeLogger.notesPlaceholder')}
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />
          </View>
        </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
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
});
