import React, { useEffect, useState } from 'react';
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

interface ReadingTimeLoggerProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function ReadingTimeLogger({ visible, onClose, onSuccess }: ReadingTimeLoggerProps) {
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
      Alert.alert('Invalid Input', 'Please enter a valid number of minutes');
      return;
    }

    if (!selectedBook) {
      Alert.alert('Select a Book', 'Please select which book you were reading');
      return;
    }

    setLoading(true);
    try {
      // Create reading_sessions table if it doesn't exist
      await execute(`
        CREATE TABLE IF NOT EXISTS reading_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          minutes_read INTEGER NOT NULL,
          date TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          FOREIGN KEY (book_id) REFERENCES enhanced_books (id)
        )
      `);

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Insert the reading session
      await execute(
        `INSERT INTO reading_sessions (book_id, minutes_read, date, notes) 
         VALUES (?, ?, ?, ?)`,
        [selectedBook.id, Number(minutes), today, notes.trim() || null]
      );

      // Reset form
      setMinutes('');
      setSelectedBook(currentlyReadingBooks.length === 1 ? currentlyReadingBooks[0] : null);
      setNotes('');
      
      onSuccess();
      onClose();
      
      Alert.alert('Success! 🎉', `Logged ${minutes} minutes of reading for "${selectedBook.name}"`);
    } catch (error) {
      console.error('Error logging reading time:', error);
      Alert.alert('Error', 'Failed to log reading time. Please try again.');
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
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📖 Log Reading Time</Text>
          <TouchableOpacity 
            onPress={handleSubmit} 
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Book Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📚 Which book were you reading?</Text>
            {currentlyReadingBooks.length === 0 ? (
              <View style={styles.noBooks}>
                <Text style={styles.noBooksText}>
                  No currently reading books found. Add a book to your "Currently Reading" list first.
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
                        by {book.author}
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
            <Text style={styles.sectionTitle}>⏰ How many minutes did you read?</Text>
            
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
                placeholder="Enter custom minutes"
                placeholderTextColor="#94A3B8"
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="numeric"
                returnKeyType="next"
              />
              <Text style={styles.minutesLabel}>minutes</Text>
            </View>
          </View>

          {/* Notes (Optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="How was your reading session? Any thoughts on the book?"
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
