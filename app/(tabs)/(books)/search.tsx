import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import BookStatusModal, { BookStatus } from '../../../components/BookStatusModal';
import { execute } from '../../../db/db';
import { OpenLibraryService, SearchBookResult } from '../../../services/openLibrary';

export default function BookSearchScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchBookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<'general' | 'title' | 'author'>('general');
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedBook, setSelectedBook] = useState<SearchBookResult | null>(null);
  const [statusModalFadeAnim] = useState(new Animated.Value(0));
  const [statusModalScaleAnim] = useState(new Animated.Value(0.8));
  const [clickedSearch, setClickedSearch] = useState(false);

  const searchTypeLabels = {
    general: t('booksPage.search.general'),
    title: t('booksPage.search.title'),
    author: t('booksPage.search.author'),
  };

  useEffect(() => {
    // Reset search results when search type changes
    setClickedSearch(false);
  }, []);
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert(t('booksPage.search.error'), t('booksPage.search.enterSearchTerm'));
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setClickedSearch(true);
    try {
      let results: SearchBookResult[] = [];
      
      switch (searchType) {
        case 'title':
          results = await OpenLibraryService.searchByTitle(searchQuery.trim());
          break;
        case 'author':
          results = await OpenLibraryService.searchByAuthor(searchQuery.trim());
          break;
        default:
          results = await OpenLibraryService.searchBooks(searchQuery.trim());
          break;
      }
      
      setSearchResults(results);
      
      if (results.length === 0) {
        Alert.alert('No Results', 'No books found for your search. Try different keywords.');
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', error instanceof Error ? error.message : 'Failed to search books');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBook = async (book: SearchBookResult) => {
    setSelectedBook(book);
    openStatusModal();
  };

  const openStatusModal = () => {
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

  const handleStatusChange = async (status: BookStatus) => {
    if (!selectedBook) return;

    try {
      const subjects = selectedBook.subjects ? JSON.stringify(selectedBook.subjects) : null;
      
      let dateField = '';
      let dateValue = null;

      // Set appropriate date fields based on status
      if (status === 'currently_reading') {
        dateField = ', date_started';
        dateValue = new Date().toISOString();
      } else if (status === 'read') {
        dateField = ', date_finished';
        dateValue = new Date().toISOString();
      }

      const query = `
        INSERT INTO enhanced_books (
          name, author, page, isbn, cover_id, cover_url,
          first_publish_year, publisher, language, subjects,
          open_library_key, author_key, rating, reading_status, date_added${dateField}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${dateValue ? ', ?' : ''})
      `;

      const params = [
        selectedBook.title,
        selectedBook.authors.join(', '),
        selectedBook.pageCount || 0,
        selectedBook.isbn || null,
        selectedBook.coverId || null,
        selectedBook.coverUrl || null,
        selectedBook.firstPublishYear || null,
        selectedBook.publisher || null,
        selectedBook.language || 'eng',
        subjects,
        selectedBook.key,
        null, // author_key - would need additional processing
        selectedBook.rating || null,
        status,
        new Date().toISOString(),
      ];

      if (dateValue) {
        params.push(dateValue);
      }
      
      await execute(query, params);
      
      const statusText = status === 'want_to_read' ? 'Want to Read' : 
                        status === 'currently_reading' ? 'Currently Reading' : 'Read';
      
      Alert.alert('Success', `"${selectedBook.title}" has been added to your library as ${statusText}!`, [
        {
          text: 'OK',
          onPress: () => router.back(),
        }
      ]);
    } catch (error) {
      console.error('Error adding book:', error);
      Alert.alert('Error', 'Failed to add book to your library. Please try again.');
    }
  };

  const renderBookItem = ({ item, index }: { item: SearchBookResult; index: number }) => (
    <TouchableOpacity 
      style={[styles.bookItem, index === searchResults.length - 1 && styles.lastBookItem]} 
      onPress={() => handleSelectBook(item)}
    >
      <View style={styles.bookCoverContainer}>
        {item.coverUrl ? (
          <Image
            source={{ uri: item.coverUrl }}
            style={styles.bookCover}
            defaultSource={require('../../../assets/images/icon.png')}
          />
        ) : (
          <View style={styles.bookCoverPlaceholder}>
            <Text style={styles.bookCoverPlaceholderText}>📖</Text>
          </View>
        )}
      </View>
      
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          by {item.authors.join(', ')}
        </Text>
        
        <View style={styles.bookMetadata}>
          {item.firstPublishYear && (
            <View style={styles.metadataItem}>
              <Text style={styles.metadataIcon}>📅</Text>
              <Text style={styles.metadataText}>{item.firstPublishYear}</Text>
            </View>
          )}
          {item.pageCount && (
            <View style={styles.metadataItem}>
              <Text style={styles.metadataIcon}>📄</Text>
              <Text style={styles.metadataText}>{item.pageCount} pages</Text>
            </View>
          )}
        </View>
        
        {item.publisher && (
          <View style={styles.publisherContainer}>
            <Text style={styles.metadataIcon}>🏢</Text>
            <Text style={styles.publisherText} numberOfLines={1}>
              {item.publisher}
            </Text>
          </View>
        )}
        
        {item.rating && item.ratingsCount && (
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>⭐ {item.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({item.ratingsCount} ratings)</Text>
          </View>
        )}
        
        {item.subjects && item.subjects.length > 0 && (
          <View style={styles.subjectsContainer}>
            {item.subjects.slice(0, 3).map((subject, index) => (
              <View key={index} style={styles.subjectTag}>
                <Text style={styles.subjectText}>{subject}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      
      <View style={styles.addButtonContainer}>
        <View style={styles.addButton}>
          <Text style={styles.addButtonText}>+</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        <Stack.Screen 
          options={{ 
            title: 'Search Books',
            headerStyle: { backgroundColor: '#6C63FF' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
          }} 
        />
        
        {/* Search Header */}
        <View style={styles.searchHeader}>
          <Text style={styles.searchTitle}>🔍 Discover New Books</Text>
          <Text style={styles.searchSubtitle}>Search millions of books from Open Library</Text>
        </View>

        {/* Search Type Selection */}
        <View style={styles.searchTypeContainer}>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === 'general' && styles.searchTypeButtonActive,
            ]}
            onPress={() => setSearchType('general')}
          >
            <Text style={[
              styles.searchTypeText,
              searchType === 'general' && styles.searchTypeTextActive,
            ]}>
              {searchTypeLabels.general}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === 'title' && styles.searchTypeButtonActive,
            ]}
            onPress={() => setSearchType('title')}
          >
            <Text style={[
              styles.searchTypeText,
              searchType === 'title' && styles.searchTypeTextActive,
            ]}>
              {searchTypeLabels.title}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === 'author' && styles.searchTypeButtonActive,
            ]}
            onPress={() => setSearchType('author')}
          >
            <Text style={[
              styles.searchTypeText,
              searchType === 'author' && styles.searchTypeTextActive,
            ]}>
              {searchTypeLabels.author}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t(`booksPage.search.placeholder`)}
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.searchButton, loading && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            <Text style={styles.searchButtonText}>
              {loading ? 'Searching...' : 'Search'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        <View style={styles.resultsContainer}>
          {searchResults.length > 0 && (
            <Text style={styles.resultsCount}>
              Found {searchResults.length} book{searchResults.length !== 1 ? 's' : ''}
            </Text>
          )}
          
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.key}
            renderItem={renderBookItem}
            style={styles.resultsList}
            contentContainerStyle={styles.resultsListContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !loading && clickedSearch &&
              searchQuery.trim() !== '' &&
              searchResults.length === 0 ? (
                <View style={styles.emptyResults}>
                  <Text style={styles.emptyResultsIcon}>📚</Text>
                  <Text style={styles.emptyResultsText}>No books found</Text>
                  <Text style={styles.emptyResultsSubtext}>
                    Try different search terms or check your spelling
                  </Text>
                </View>
              ) : searchResults.length === 0 && !clickedSearch ? (
                <View style={styles.emptyResults}>
                  <Text style={styles.emptyResultsIcon}>🔍</Text>
                  <Text style={styles.emptyResultsText}>Start searching</Text>
                  <Text style={styles.emptyResultsSubtext}>
                    Enter a book title, author name, or keywords to discover new books
                  </Text>
                </View>
              ) : null
            }
          />
          
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6C63FF" />
              <Text style={styles.loadingText}>Searching books...</Text>
            </View>
          )}
        </View>

        <BookStatusModal
          visible={statusModalVisible}
          bookTitle={selectedBook?.title || ''}
          currentStatus="currently_reading"
          onStatusChange={handleStatusChange}
          onClose={closeStatusModal}
          fadeAnim={statusModalFadeAnim}
          scaleAnim={statusModalScaleAnim}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  searchSubtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  searchTypeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  searchTypeButtonActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  searchTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  searchTypeTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    height: 52,
    borderColor: '#E2E8F0',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#1E293B',
  },
  searchButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  resultsCount: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 16,
    fontWeight: '600',
  },
  resultsList: {
    flex: 1,
  },
  resultsListContent: {
    paddingBottom: 20,
  },
  bookItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  lastBookItem: {
    marginBottom: 0,
  },
  bookCoverContainer: {
    marginRight: 16,
  },
  bookCover: {
    width: 80,
    height: 120,
    borderRadius: 12,
  },
  bookCoverPlaceholder: {
    width: 80,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookCoverPlaceholderText: {
    fontSize: 32,
  },
  bookInfo: {
    flex: 1,
    paddingRight: 12,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
    lineHeight: 24,
  },
  bookAuthor: {
    fontSize: 16,
    color: '#6C63FF',
    fontWeight: '600',
    marginBottom: 12,
  },
  bookMetadata: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metadataIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  metadataText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  publisherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  publisherText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginRight: 6,
  },
  ratingCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  subjectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subjectText: {
    fontSize: 12,
    color: '#6C63FF',
    fontWeight: '600',
  },
  addButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  emptyResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyResultsIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyResultsText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  emptyResultsSubtext: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
    fontWeight: '500',
  },
});
