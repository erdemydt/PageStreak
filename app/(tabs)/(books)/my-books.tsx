import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BookCard from '../../../components/BookCard';
import BookDetailModal from '../../../components/BookDetailModal';
import BookStatusModal, { BookStatus } from '../../../components/BookStatusModal';
import { EnhancedBook, execute, queryAll } from '../../../db/db';
import { getBookReadingTime, initializeReadingSessions } from '../../../utils/readingProgress';

type SortOption = 'date_added' | 'title' | 'author' | 'reading_time' | 'progress';
type SortDirection = 'asc' | 'desc';

export default function MyBooksScreen() {
  const { t } = useTranslation();
  
  const [books, setBooks] = useState<(EnhancedBook & { reading_time?: number })[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<(EnhancedBook & { reading_time?: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<BookStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date_added');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedBook, setSelectedBook] = useState<EnhancedBook | null>(null);
  const [statusModalFadeAnim] = useState(new Animated.Value(0));
  const [statusModalScaleAnim] = useState(new Animated.Value(0.8));
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailModalFadeAnim] = useState(new Animated.Value(0));
  const [detailModalScaleAnim] = useState(new Animated.Value(0.8));
  const [selectedBookForDetail, setSelectedBookForDetail] = useState<(EnhancedBook & { reading_time?: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      initializeReadingSessions().then(() => {
        loadBooks();
      });
    }, [])
  );

  const loadBooks = async () => {
    setLoading(true);
    try {
      // Get all books with reading progress data
      const booksData = await queryAll<EnhancedBook>(`
        SELECT * FROM enhanced_books 
        ORDER BY 
          CASE WHEN reading_status = 'currently_reading' THEN 1 
               WHEN reading_status = 'want_to_read' THEN 2 
               WHEN reading_status = 'read' THEN 3 
               ELSE 4 END,
          date_added DESC
      `);
      
      // Fetch reading time for each book
      const booksWithReadingTime = await Promise.all(
        booksData.map(async (book) => {
          const readingTime = await getBookReadingTime(book.id);
          return { ...book, reading_time: readingTime };
        })
      );
      
      setBooks(booksWithReadingTime);
      setFilteredBooks(booksWithReadingTime);
    } catch (e) {
      setError('Failed to load books');
      console.error('Load books error:', e);
    } finally {
      setLoading(false);
    }
  };
  
  const deleteBook = async (bookId: number, bookTitle: string) => {
    Alert.alert(
      'Delete Book',
      `Are you sure you want to delete "${bookTitle}"? This will also remove all reading session data for this book.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Delete reading sessions first (foreign key constraint)
              await execute('DELETE FROM reading_sessions WHERE book_id = ?', [bookId]);
              // Delete the book
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
      const statusText = newStatus === 'want_to_read' ? 'Want to Read' : 
                        newStatus === 'currently_reading' ? 'Currently Reading' : 'Read';
      
      Alert.alert('Status Updated', `Book status has been updated to ${statusText}.`);
    } catch (e) {
      setError('Failed to update book status');
      console.error('Update status error:', e);
      Alert.alert('Error', 'Failed to update book status. Please try again.');
    } finally {
      setLoading(false);
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



  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...books];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(book =>
        book.name.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        book.publisher?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(book => book.reading_status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'title':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'author':
          aValue = a.author.toLowerCase();
          bValue = b.author.toLowerCase();
          break;
        case 'reading_time':
          aValue = a.reading_time || 0;
          bValue = b.reading_time || 0;
          break;
        case 'progress':
          aValue = (a.current_page || 0) / a.page;
          bValue = (b.current_page || 0) / b.page;
          break;
        case 'date_added':
        default:
          aValue = new Date(a.date_added || '').getTime();
          bValue = new Date(b.date_added || '').getTime();
          break;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredBooks(filtered);
  }, [books, searchQuery, filterStatus, sortBy, sortDirection]);

  // Apply filters when dependencies change
  useFocusEffect(
    useCallback(() => {
      applyFiltersAndSort();
    }, [applyFiltersAndSort])
  );

  const getSortLabel = (option: SortOption) => {
    switch (option) {
      case 'date_added':
        return t('booksPage.sort.dateAdded');
      case 'title':
        return t('booksPage.sort.title');
      case 'author':
        return t('booksPage.sort.author');
      case 'reading_time':
        return t('booksPage.sort.readingTime');
      case 'progress':
        return t('booksPage.sort.progress');
      default:
        return t('booksPage.sort.unknown');
    }
  };

  const getStatusCount = (status: BookStatus) => {
    return `${t(`booksPage.status.${status}`)} (${books.filter(book => book.reading_status === status).length})`;
  };

  const renderBook = ({ item }: { item: EnhancedBook & { reading_time?: number } }) => (
    <BookCard
      book={item}
      smaller={true}
      showDeleteButton={true}
      showStatusButton={true}
      showReadingTime={true}
      readingTimeMinutes={item.reading_time || 0}
      onPress={() => openDetailModal(item)}
      onDelete={() => deleteBook(item.id, item.name)}
      onStatusChange={() => openStatusModal(item)}
    />
  );

  const keyExtractor = (item: EnhancedBook & { reading_time?: number }) => item.id.toString();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'My Books' }} />
      
      <BookStatusModal
        visible={statusModalVisible}
        bookTitle={selectedBook?.name || ''}
        currentStatus={(selectedBook?.reading_status || 'currently_reading') as BookStatus}
        onStatusChange={handleStatusChange}
        onClose={() => {
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
        }}
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

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, author, or publisher..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {/* Filter and Sort Controls */}
      <View style={styles.controlsContainer}>
        {/* Status Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.controlLabel}>Filter:</Text>
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
                All ({books.length})
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
                Reading ({getStatusCount('currently_reading')})
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
                Want ({getStatusCount('want_to_read')})
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
                Read ({getStatusCount('read')})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sort Controls */}
        <View style={styles.sortSection}>
          <Text style={styles.controlLabel}>Sort by:</Text>
          <View style={styles.sortControls}>
            <View style={styles.sortOptions}>
              {(['date_added', 'title', 'author', 'reading_time', 'progress'] as SortOption[]).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.sortOption,
                    sortBy === option && styles.sortOptionActive
                  ]}
                  onPress={() => setSortBy(option)}
                >
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === option && styles.sortOptionTextActive
                  ]}>
                    {getSortLabel(option)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={styles.sortDirectionBtn}
              onPress={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            >
              <Text style={styles.sortDirectionText}>
                {sortDirection === 'asc' ? '↑' : '↓'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Books List */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.resultsText}>
            {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
            {searchQuery ? ` matching "${searchQuery}"` : ''}
          </Text>
        </View>

        <FlatList
          data={filteredBooks}
          keyExtractor={keyExtractor}
          renderItem={renderBook}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No matching books found' : 'No books yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery 
                  ? 'Try adjusting your search or filters' 
                  : 'Start building your library by adding some books!'
                }
              </Text>
            </View>
          }
          style={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={20}
          windowSize={10}
          onEndReachedThreshold={0.5}
        />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    height: 48,
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    fontSize: 16,
    color: '#1E293B',
  },
  controlsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sortSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  sortControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  sortOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  sortOptionActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  sortOptionTextActive: {
    color: '#6C63FF',
    fontWeight: '600',
  },
  sortDirectionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortDirectionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  resultsText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 280,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FEE2E2',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
