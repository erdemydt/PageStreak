import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Animated, FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BookCard from '../../components/BookCard';
import BookSearchModal from '../../components/BookSearchModal';
import { EnhancedBook, execute, queryAll } from '../../db/db';
import { SearchBookResult } from '../../services/openLibrary';

type BooksearchProps = {
  name: string;
  setName: (name: string) => void;
  author: string;
  setAuthor: (author: string) => void;
  page: string;
  setPage: (page: string) => void;
  loading: boolean;
  error: string | null;
  saveBook: () => void;
  onClose: () => void;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
};

function ManualBookEntry(props: BooksearchProps) {
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
          <Text style={styles.cardTitle}>Add Book Manually</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={props.onClose}
            disabled={props.loading}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="Book Name" placeholderTextColor="#9CA3AF" value={props.name} onChangeText={props.setName} editable={!props.loading} autoCapitalize="words" returnKeyType="next" />
          <TextInput style={styles.input} placeholder="Author" placeholderTextColor="#9CA3AF" value={props.author} onChangeText={props.setAuthor} editable={!props.loading} autoCapitalize="words" returnKeyType="next" />
          <TextInput style={styles.input} placeholder="Page Count" placeholderTextColor="#9CA3AF" value={props.page} onChangeText={props.setPage} editable={!props.loading} keyboardType="numeric" returnKeyType="done" onSubmitEditing={props.saveBook} />
          <TouchableOpacity style={[styles.saveBtn, (!props.name.trim() || !props.author.trim() || !props.page.trim() || props.loading) && styles.saveBtnDisabled]} onPress={props.saveBook} disabled={props.loading || !props.name.trim() || !props.author.trim() || !props.page.trim()}>
            <Text style={styles.saveBtnText}>{props.loading ? 'Saving...' : 'Add Book'}</Text>
          </TouchableOpacity>
        </View>
        {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
      </Animated.View>
    </View>
  );
}

export default function BooksScreen() {
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [page, setPage] = useState('');
  const [books, setBooks] = useState<EnhancedBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddingManually, setIsAddingManually] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    initializeDatabase();
  }, []);

  const initializeDatabase = async () => {
    try {
      // Create enhanced books table with new fields
      await execute(`
        CREATE TABLE IF NOT EXISTS enhanced_books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          author TEXT NOT NULL,
          page INTEGER NOT NULL,
          isbn TEXT,
          cover_id INTEGER,
          cover_url TEXT,
          first_publish_year INTEGER,
          publisher TEXT,
          language TEXT DEFAULT 'eng',
          description TEXT,
          subjects TEXT,
          open_library_key TEXT,
          author_key TEXT,
          rating REAL,
          date_added TEXT DEFAULT CURRENT_TIMESTAMP,
          date_started TEXT,
          date_finished TEXT,
          current_page INTEGER DEFAULT 0,
          reading_status TEXT DEFAULT 'want_to_read',
          notes TEXT
        )
      `);

      // Migrate existing books if they exist
      await migrateOldBooks();
      await loadBooks();
    } catch (e) {
      console.error('Database initialization error:', e);
      setError('Failed to initialize database');
    }
  };

  const migrateOldBooks = async () => {
    try {
      // Check if old books table exists and has data
      const oldBooks = await queryAll<{id: number, name: string, author: string, page: number}>('SELECT * FROM books');
      
      for (const book of oldBooks) {
        // Check if book already exists in enhanced_books
        const existing = await queryAll('SELECT id FROM enhanced_books WHERE name = ? AND author = ?', [book.name, book.author]);
        
        if (existing.length === 0) {
          await execute(`
            INSERT INTO enhanced_books (name, author, page, reading_status, date_added)
            VALUES (?, ?, ?, 'read', datetime('now'))
          `, [book.name, book.author, book.page]);
        }
      }
    } catch (e) {
      // Old books table doesn't exist, which is fine
      console.log('No old books to migrate');
    }
  };

  const loadBooks = async () => {
    setLoading(true);
    try {
      const res = await queryAll<EnhancedBook>('SELECT * FROM enhanced_books ORDER BY date_added DESC');
      setBooks(res);
    } catch (e) {
      setError('Failed to load books');
      console.error('Load books error:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveManualBook = async () => {
    if (!name.trim() || !author.trim() || !page.trim() || isNaN(Number(page))) return;
    setLoading(true);
    setError(null);
    try {
      await execute(`
        INSERT INTO enhanced_books (name, author, page, reading_status, date_added)
        VALUES (?, ?, ?, 'read', datetime('now'))
      `, [name.trim(), author.trim(), Number(page)]);
      
      setName('');
      setAuthor('');
      setPage('');
      Keyboard.dismiss();
      await loadBooks();
      toggleManualForm();
    } catch (e) {
      setError('Failed to save book');
      console.error('Save manual book error:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveSearchedBook = async (searchResult: SearchBookResult) => {
    setLoading(true);
    setError(null);
    try {
      const subjects = searchResult.subjects ? JSON.stringify(searchResult.subjects) : null;
      
      await execute(`
        INSERT INTO enhanced_books (
          name, author, page, isbn, cover_id, cover_url,
          first_publish_year, publisher, language, subjects,
          open_library_key, author_key, rating, reading_status, date_added
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'want_to_read', datetime('now'))
      `, [
        searchResult.title,
        searchResult.authors.join(', '),
        searchResult.pageCount || 0,
        searchResult.isbn || null,
        searchResult.coverId || null,
        searchResult.coverUrl || null,
        searchResult.firstPublishYear || null,
        searchResult.publisher || null,
        searchResult.language || 'eng',
        subjects,
        searchResult.key,
        null, // author_key - would need additional processing
        searchResult.rating || null,
      ]);
      
      await loadBooks();
      toggleSearchModal();
      
      Alert.alert('Success', `"${searchResult.title}" has been added to your library!`);
    } catch (e) {
      setError('Failed to save book from search');
      console.error('Save searched book error:', e);
    } finally {
      setLoading(false);
    }
  };

  const deleteBook = async (bookId: number, bookTitle: string) => {
    Alert.alert(
      'Delete Book',
      `Are you sure you want to delete "${bookTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
        setError(null);
      });
    }
  };

  const toggleSearchModal = () => {
    setIsSearching(!isSearching);
    if (!isSearching) {
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
        setError(null);
      });
    }
  };

  const renderBook = ({ item }: { item: EnhancedBook }) => (
    <BookCard
      book={item}
      showDeleteButton={true}
      onDelete={() => deleteBook(item.id, item.name)}
    />
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Books' }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📖 Book Library</Text>
          <Text style={styles.subtitle}>Discover and track your reading journey</Text>
        </View>

        {isAddingManually && (
          <ManualBookEntry 
            name={name} 
            setName={setName} 
            author={author} 
            setAuthor={setAuthor} 
            page={page} 
            setPage={setPage} 
            loading={loading} 
            error={error} 
            saveBook={saveManualBook}
            onClose={toggleManualForm}
            fadeAnim={fadeAnim}
            scaleAnim={scaleAnim}
          />
        )}

        <BookSearchModal
          visible={isSearching}
          onClose={toggleSearchModal}
          onSelectBook={saveSearchedBook}
          fadeAnim={fadeAnim}
          scaleAnim={scaleAnim}
        />

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, isAddingManually && styles.nonVisibleBtn]}
            onPress={toggleSearchModal}
            disabled={loading || isAddingManually}
          >
            <Text style={styles.actionBtnText}>🔍 Search Books</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.secondaryBtn, isAddingManually && styles.nonVisibleBtn]}
            onPress={toggleManualForm}
            disabled={loading || isSearching}
          >
            <Text style={[styles.actionBtnText, styles.secondaryBtnText]}>✏️ Add Manually</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>📚 My Books ({books.length})</Text>
          <FlatList
            data={books}
            keyExtractor={item => item.id.toString()}
            renderItem={renderBook}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyTitle}>No books yet</Text>
                <Text style={styles.emptySubtitle}>Search for books online or add them manually!</Text>
              </View>
            }
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </>
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
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#6C63FF',
    paddingVertical: 14,
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
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
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
});
