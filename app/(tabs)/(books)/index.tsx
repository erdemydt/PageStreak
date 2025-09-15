import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import BookCard from '../../../components/BookCard';
import BookDetailModal from '../../../components/BookDetailModal';
import BookStatusModal, { BookStatus } from '../../../components/BookStatusModal';
import { EnhancedBook, execute, queryAll } from '../../../db/db';
import { getBookReadingTime } from '../../../utils/readingProgress';
type BooksearchProps = {
  name: string;
  setName: (name: string) => void;
  author: string;
  setAuthor: (author: string) => void;
  page: string;
  setPage: (page: string) => void;
  selectedStatus: BookStatus;
  onStatusChange: (status: BookStatus) => void;
  loading: boolean;
  error: string | null;
  saveBook: () => void;
  onClose: () => void;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
};

function ManualBookEntry(props: BooksearchProps) {
  const { t } = useTranslation();
  const getStatusColor = (status: BookStatus) => {
    switch (status) {
      case 'currently_reading':
        return '#3B82F6';
      case 'read':
        return '#10B981';
      case 'want_to_read':
        return '#F59E0B';
      default:
        return '#64748B';
    }
  };
  const getStatusText = (status: BookStatus) => {
    switch (status) {
      case 'currently_reading':
        return t('components.bookCard.currentlyReading');
      case 'read':
        return t('components.bookCard.read');
      case 'want_to_read':
        return t('components.bookCard.wantToRead');
      default:
        return t('components.bookCard.unknown');
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <Animated.View 
        style={[
          styles.modalCard, 
          {
            opacity: props.fadeAnim,
            transform: [{ scale: props.scaleAnim }],
          }
        ]}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.cardTitle}>{t('components.bookSearchModal.title')}</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={props.onClose}
            disabled={props.loading}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder={t('components.bookSearchModal.title')} placeholderTextColor="#9CA3AF" value={props.name} onChangeText={props.setName} editable={!props.loading} autoCapitalize="words" returnKeyType="next" />
          <TextInput style={styles.input} placeholder={t('components.bookSearchModal.author')} placeholderTextColor="#9CA3AF" value={props.author} onChangeText={props.setAuthor} editable={!props.loading} autoCapitalize="words" returnKeyType="next" />
          <TextInput style={styles.input} placeholder={t('components.bookSearchModal.pageCount')} placeholderTextColor="#9CA3AF" value={props.page} onChangeText={props.setPage} editable={!props.loading} keyboardType="numeric" returnKeyType="done" onSubmitEditing={props.saveBook} />

          <View style={styles.statusSelectionContainer}>
            <Text style={styles.statusSelectionLabel}>{t('components.bookDetailModal.status')}</Text>
            <View style={styles.statusButtons}>
              {(['want_to_read', 'currently_reading', 'read'] as BookStatus[]).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    props.selectedStatus === status && [
                      styles.statusButtonActive,
                      { borderColor: getStatusColor(status) }
                    ]
                  ]}
                  onPress={() => props.onStatusChange(status)}
                  disabled={props.loading}
                >
                  <Text style={[
                    styles.statusButtonText,
                    props.selectedStatus === status && [
                      styles.statusButtonTextActive,
                      { color: getStatusColor(status) }
                    ]
                  ]}>
                    {getStatusText(status)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={[styles.saveBtn, (!props.name.trim() || !props.author.trim() || !props.page.trim() || props.loading) && styles.saveBtnDisabled]} onPress={props.saveBook} disabled={props.loading || !props.name.trim() || !props.author.trim() || !props.page.trim()}>
            <Text style={styles.saveBtnText}>{props.loading ? t("booksPage.saving") : t("booksPage.addBook")}</Text>
          </TouchableOpacity>
        </View>
        {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
      </Animated.View>
    </View>
  );
}

export default function HomeScreen() {

  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [page, setPage] = useState('');
  const [books, setBooks] = useState<(EnhancedBook & { reading_time?: number })[]>([]);
  const [allBooksCount, setAllBooksCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState({
    want_to_read: 0,
    currently_reading: 0,
    read: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddingManually, setIsAddingManually] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedBook, setSelectedBook] = useState<EnhancedBook | null>(null);
  const [statusModalFadeAnim] = useState(new Animated.Value(0));
  const [statusModalScaleAnim] = useState(new Animated.Value(0.8));
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailModalFadeAnim] = useState(new Animated.Value(0));
  const [detailModalScaleAnim] = useState(new Animated.Value(0.8));
  const [selectedBookForDetail, setSelectedBookForDetail] = useState<(EnhancedBook & { reading_time?: number }) | null>(null);
  const [manualBookStatus, setManualBookStatus] = useState<BookStatus>('currently_reading');
  const [filterStatus, setFilterStatus] = useState<BookStatus | 'all'>('all');

  useEffect(() => {
    // Database is already initialized by the main app entry point
    loadBooks();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [])
  );
  const { t } = useTranslation();
  const loadBooks = async () => {
    setLoading(true);
    try {
      // Get total counts first
      const totalResult = await queryAll<{total: number}>('SELECT COUNT(*) as total FROM enhanced_books');
      const totalCount = totalResult[0]?.total || 0;
      setAllBooksCount(totalCount);

      // Get status counts
      const statusCountsResult = await queryAll<{reading_status: string, count: number}>(`
        SELECT reading_status, COUNT(*) as count 
        FROM enhanced_books 
        GROUP BY reading_status
      `);
      
      const counts = { want_to_read: 0, currently_reading: 0, read: 0 };
      statusCountsResult.forEach(row => {
        if (row.reading_status in counts) {
          counts[row.reading_status as keyof typeof counts] = row.count;
        }
      });
      setStatusCounts(counts);

      // Get books with default sorting (currently reading -> want to read -> read)
      const res = await queryAll<EnhancedBook>(`
        SELECT * FROM enhanced_books 
        ORDER BY 
          CASE WHEN reading_status = 'currently_reading' THEN 1 
               WHEN reading_status = 'want_to_read' THEN 2 
               WHEN reading_status = 'read' THEN 3 
               ELSE 4 END,
          date_added DESC
        LIMIT 10
      `);
      
      // Fetch reading time for each book (only for preview)
      const booksWithReadingTime = await Promise.all(
        res.map(async (book) => {
          const readingTime = await getBookReadingTime(book.id);
          return { ...book, reading_time: readingTime };
        })
      );
      
      setBooks(booksWithReadingTime);
    } catch (e) {
      setError(t('booksPage.failedToLoad'));
      console.error('Load books error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredBooks = () => {
    if (filterStatus === 'all') {
      return books;
    }
    return books.filter(book => book.reading_status === filterStatus);
  };

  const getStatusCount = (status: BookStatus) => {
    return statusCounts[status] || 0;
  };

  const saveManualBook = async () => {
    if (!name.trim() || !author.trim() || !page.trim() || isNaN(Number(page))) return;
    setLoading(true);
    setError(null);
    try {
      let dateField = '';
      let dateValue = null;

      // Set appropriate date fields based on status
      if (manualBookStatus === 'currently_reading') {
        dateField = ', date_started';
        dateValue = new Date().toISOString();
      } else if (manualBookStatus === 'read') {
        dateField = ', date_finished';
        dateValue = new Date().toISOString();
      }

      const query = `
        INSERT INTO enhanced_books (name, author, page, reading_status, date_added${dateField})
        VALUES (?, ?, ?, ?, ? ${dateValue ? ', ?' : ''})
      `;

      const params = [name.trim(), author.trim(), Number(page), manualBookStatus, new Date().toISOString()];
      if (dateValue) {
        params.push(dateValue);
      }

      await execute(query, params);
      
      setName('');
      setAuthor('');
      setPage('');
      setManualBookStatus('currently_reading');
      Keyboard.dismiss();
      await loadBooks();
      toggleManualForm();
    } catch (e) {
      setError(t('booksPage.failedToSave'));
      console.error('Save manual book error:', e);
    } finally {
      setLoading(false);
    }
  };

  const deleteBook = async (bookId: number, bookTitle: string) => {
    Alert.alert(
      t('booksPage.alert.deleteTitle'),
      t('booksPage.alert.deleteMessage', { title: bookTitle }),
      [
        { text: t('booksPage.alert.cancel'), style: 'cancel' },
        {
          text: t('booksPage.alert.delete'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              await execute('DELETE FROM enhanced_books WHERE id = ?', [bookId]);
              await loadBooks();
            } catch (e) {
              setError('Failed to delete book');
              console.error('Delete book error:', e);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const toggleManualForm = () => {
    if (!isAddingManually) {
      setIsAddingManually(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsAddingManually(false);
        setName('');
        setAuthor('');
        setPage('');
        setManualBookStatus('currently_reading');
        setError(null);
      });
    }
  };

  const openStatusModal = (book: EnhancedBook) => {
    setSelectedBook(book);
    setStatusModalVisible(true);
    Animated.parallel([
      Animated.timing(statusModalFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(statusModalScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeStatusModal = () => {
    Animated.parallel([
      Animated.timing(statusModalFadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(statusModalScaleAnim, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStatusModalVisible(false);
      setSelectedBook(null);
    });
  };

  const handleStatusChange = async (newStatus: BookStatus) => {
    if (!selectedBook) return;

    setLoading(true);
    setError(null);

    try {
      let dateField = '';
      let dateValue = null;

      // Set appropriate date fields based on status
      if (newStatus === 'currently_reading') {
        dateField = ', date_started = ?';
        dateValue = new Date().toISOString();
      } else if (newStatus === 'read') {
        dateField = ', date_finished = ?';
        dateValue = new Date().toISOString();
      }

      const query = `UPDATE enhanced_books SET reading_status = ?${dateField} WHERE id = ?`;
      const params = dateValue 
        ? [newStatus, dateValue, selectedBook.id]
        : [newStatus, selectedBook.id];
      // remove finished date if switching back to currently_reading or want_to_read
      if (newStatus !== 'read') {
        await execute('UPDATE enhanced_books SET date_finished = NULL WHERE id = ?', [selectedBook.id]);
      }
      await execute(query, params);
      await loadBooks();

      // Show success message
      const statusText = newStatus === 'want_to_read' ? 'Want to Read' : 
                        newStatus === 'currently_reading' ? 'Currently Reading' : 'Read';
      
      Alert.alert('Status Updated', `"${selectedBook.name}" has been marked as ${statusText}.`);
    } catch (e) {
      setError('Failed to update book status');
      console.error('Update status error:', e);
      Alert.alert('Error', 'Failed to update book status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDetailModalStatusChange = async (bookId: number, newStatus: BookStatus) => {
    setLoading(true);
    setError(null);

    try {
      let dateField = '';
      let dateValue = null;

      // Set appropriate date fields based on status
      if (newStatus === 'currently_reading') {
        dateField = ', date_started = ?';
        dateValue = new Date().toISOString();
      } else if (newStatus === 'read') {
        dateField = ', date_finished = ?';
        dateValue = new Date().toISOString();
      }

      const query = `UPDATE enhanced_books SET reading_status = ?${dateField} WHERE id = ?`;
      const params = dateValue 
        ? [newStatus, dateValue, bookId]
        : [newStatus, bookId];
      
      // remove finished date if switching back to currently_reading or want_to_read
      if (newStatus !== 'read') {
        await execute('UPDATE enhanced_books SET date_finished = NULL WHERE id = ?', [bookId]);
      }
      await execute(query, params);
      await loadBooks();

      // Update the selected book for detail modal
      if (selectedBookForDetail && selectedBookForDetail.id === bookId) {
        setSelectedBookForDetail({
          ...selectedBookForDetail,
          reading_status: newStatus,
          date_started: newStatus === 'currently_reading' ? dateValue || selectedBookForDetail.date_started : selectedBookForDetail.date_started,
          date_finished: newStatus === 'read' ? dateValue || selectedBookForDetail.date_finished : undefined,
        });
      }

      // Show success message
      const statusText = newStatus === 'want_to_read' ? t('components.bookCard.wantToRead') : 
                        newStatus === 'currently_reading' ? t('components.bookCard.currentlyReading') : t('components.bookCard.read');

      Alert.alert(t("booksPage.alert.statusUpdated"), t("booksPage.alert.bookStatusUpdated", { statusText }));
    } catch (e) {
      setError(t('booksPage.alert.failedUpdate'));
      console.error('Update status error:', e);
      Alert.alert(t('error'), t('booksPage.alert.failedUpdate'));
    } finally {
      setLoading(false);
    }
  };

  const openDetailModal = (book: EnhancedBook & { reading_time?: number }) => {
    setSelectedBookForDetail(book);
    setDetailModalVisible(true);
    Animated.parallel([
      Animated.timing(detailModalFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(detailModalScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDetailModal = () => {
    Animated.parallel([
      Animated.timing(detailModalFadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(detailModalScaleAnim, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDetailModalVisible(false);
      setSelectedBookForDetail(null);
    });
  };

  const renderBook = ({ item }: { item: EnhancedBook & { reading_time?: number } }) => (
    <BookCard
      book={item}
      showDeleteButton={true}
      showStatusButton={true}
      showReadingTime={true}
      readingTimeMinutes={item.reading_time || 0}
      onPress={() => openDetailModal(item)}
      onDelete={() => deleteBook(item.id, item.name)}
      onStatusChange={() => openStatusModal(item)}
    />
  );

  const filteredBooks = getFilteredBooks();

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={{flex: 1}}>
        <Stack.Screen options={{ title: 'Books' }} />
        <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('booksPage.title')}</Text>
          <Text style={styles.subtitle}>{t('booksPage.subtitle')}</Text>
        </View>

        {isAddingManually && (
          <ManualBookEntry 
            name={name} 
            setName={setName} 
            author={author} 
            setAuthor={setAuthor} 
            page={page} 
            setPage={setPage} 
            selectedStatus={manualBookStatus}
            onStatusChange={setManualBookStatus}
            loading={loading} 
            error={error} 
            saveBook={saveManualBook}
            onClose={toggleManualForm}
            fadeAnim={fadeAnim}
            scaleAnim={scaleAnim}
          />
        )}

        <BookStatusModal
          visible={statusModalVisible}
          bookTitle={selectedBook?.name || ''}
          currentStatus={(selectedBook?.reading_status || 'currently_reading') as BookStatus}
          onStatusChange={handleStatusChange}
          onClose={closeStatusModal}
          fadeAnim={statusModalFadeAnim}
          scaleAnim={statusModalScaleAnim}
        />

        <BookDetailModal
          visible={detailModalVisible}
          book={selectedBookForDetail}
          readingTimeMinutes={selectedBookForDetail?.reading_time || 0}
          onClose={closeDetailModal}
          onStatusChange={handleDetailModalStatusChange}
          fadeAnim={detailModalFadeAnim}
          scaleAnim={detailModalScaleAnim}
        />

        <View style={styles.actionButtons}>
          <Link href="./search" asChild style={styles.actionBtn}>
            <TouchableOpacity 
              style={ isAddingManually && styles.nonVisibleBtn}
              disabled={loading || isAddingManually}
            >
              <Text style={styles.actionBtnText }>{t('booksPage.searchButton')}</Text>
            </TouchableOpacity>
          </Link>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.secondaryBtn, isAddingManually && styles.nonVisibleBtn]}
            onPress={toggleManualForm}
            disabled={loading || isAddingManually}
          >
            <Text style={[styles.actionBtnText, styles.secondaryBtnText]}>{t('booksPage.addBookManually')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>{t('booksPage.filter.title')}</Text>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[
                styles.filterBtn,
                filterStatus === 'all' && styles.filterBtnActive
              ]}
              onPress={() => setFilterStatus('all')}
            >
              <Text style={[
                styles.filterBtnText,
                filterStatus === 'all' && styles.filterBtnTextActive
              ]}>
                {t("booksPage.filter.all")} ({allBooksCount})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterBtn,
                filterStatus === 'want_to_read' && styles.filterBtnActive
              ]}
              onPress={() => setFilterStatus('want_to_read')}
            >
              <Text style={[
                styles.filterBtnText,
                filterStatus === 'want_to_read' && styles.filterBtnTextActive
              ]}>
                {t("booksPage.filter.want_to_read")} ({getStatusCount('want_to_read')})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterBtn,
                filterStatus === 'currently_reading' && styles.filterBtnActive
              ]}
              onPress={() => setFilterStatus('currently_reading')}
            >
              <Text style={[
                styles.filterBtnText,
                filterStatus === 'currently_reading' && styles.filterBtnTextActive
              ]}>
                {t("booksPage.filter.currently_reading")} ({getStatusCount('currently_reading')})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterBtn,
                filterStatus === 'read' && styles.filterBtnActive
              ]}
              onPress={() => setFilterStatus('read')}
            >
              <Text style={[
                styles.filterBtnText,
                filterStatus === 'read' && styles.filterBtnTextActive
              ]}>
                {t("booksPage.filter.read")} ({getStatusCount('read')})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('booksPage.listHeader.myBooks') } {t('booksPage.listHeader.showing')} ({filteredBooks.length} {t('booksPage.listHeader.of')} {allBooksCount})
            </Text>
            <Link href="./my-books" asChild>
              <TouchableOpacity style={styles.viewAllButton}>
                <Text style={styles.viewAllButtonText}>{t('booksPage.listHeader.viewAll')}</Text>
              </TouchableOpacity>
            </Link>
          </View>
          <FlatList
            data={filteredBooks}
            keyExtractor={item => item.id.toString()}
            renderItem={renderBook}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyTitle}>
                  {filterStatus === 'all' ? t("booksPage.empty.noBooks") : t("booksPage.empty.noFilteredBooks", { status: filterStatus.replace('_', ' ') })}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {filterStatus === 'all' 
                    ? t("booksPage.empty.searchOrAdd") 
                    : t("booksPage.empty.tryChangingFilter")
                  }
                </Text>
              </View>
            }
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    justifyContent:'space-evenly',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {

    backgroundColor: '#6C63FF',
    padding: 10,
    margin: 0,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#6C63FF',
    shadowOpacity: 0,
    elevation: 0,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryBtnText: {
    color: '#6C63FF',
  },
  nonVisibleBtn: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    opacity: 0,
    elevation: 0,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  inputContainer: {
    gap: 12,
  },
  input: {
    height: 48,
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#1E293B',
  },
  saveBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  error: {
    color: '#EF4444',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  listSection: {
    marginTop: 8,
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  viewAllButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewAllButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64748B',
  },
  statusSelectionContainer: {
    marginBottom: 16,
  },
  statusSelectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  statusButtons: {
    gap: 8,
  },
  statusButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  statusButtonActive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
  statusButtonTextActive: {
    fontWeight: '600',
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  filterBtnActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
