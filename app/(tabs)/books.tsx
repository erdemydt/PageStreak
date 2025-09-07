import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { execute, queryAll } from '../../db/db';

export type Book = { id: number; name: string; author: string; page: number };

export default function BooksScreen() {
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [page, setPage] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  useEffect(() => {
    (async () => {
      await execute(
        'CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, author TEXT NOT NULL, page INTEGER NOT NULL)'
      );
      await loadBooks();
    })();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const res = await queryAll<Book>('SELECT * FROM books ORDER BY id DESC');
      setBooks(res);
    } catch (e) {
      setError('Failed to load books');
    } finally {
      setLoading(false);
    }
  };

  const saveBook = async () => {
    if (!name.trim() || !author.trim() || !page.trim() || isNaN(Number(page))) return;
    setLoading(true);
    setError(null);
    try {
      await execute('INSERT INTO books (name, author, page) VALUES (?, ?, ?)', [name.trim(), author.trim(), Number(page)]);
      setName('');
      setAuthor('');
      setPage('');
      Keyboard.dismiss();
      await loadBooks();
    } catch (e) {
      setError('Failed to save book');
    } finally {
      setLoading(false);
    }
  };

  const deleteBook = async (bookId: number) => {
    setLoading(true);
    setError(null);
    try {
      await execute('DELETE FROM books WHERE id = ?', [bookId]);
      await loadBooks();
    } catch (e) {
      setError('Failed to delete book');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Books' }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📖 Book Library</Text>
          <Text style={styles.subtitle}>Keep track of your reading collection</Text>
        </View>

        {isAdding && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add New Book</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Book Name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              editable={!loading}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Author"
              placeholderTextColor="#9CA3AF"
              value={author}
              onChangeText={setAuthor}
              editable={!loading}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Page Count"
              placeholderTextColor="#9CA3AF"
              value={page}
              onChangeText={setPage}
              editable={!loading}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={saveBook}
            />
            <TouchableOpacity 
              style={[styles.saveBtn, (!name.trim() || !author.trim() || !page.trim() || loading) && styles.saveBtnDisabled]} 
              onPress={saveBook} 
              disabled={loading || !name.trim() || !author.trim() || !page.trim()}
            >
              <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Add Book'}</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View> )}
        <View style={styles.addBtnContainer}>
          <TouchableOpacity
            style={[styles.addBttn, isAdding && styles.saveBtnDisabled]}
            onPress={() => setIsAdding(!isAdding)}
            disabled={loading}
          >
            <Text style={styles.addBttnText}>{isAdding ? 'Cancel  ➖' : 'Add ➕'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>📚 My Books ({books.length})</Text>
          <FlatList
            data={books}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.bookItem}>
                <View style={styles.bookIcon}>
                  <Text style={styles.bookIconText}>📖</Text>
                </View>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle}>{item.name}</Text>
                  <Text style={styles.bookAuthor}>by {item.author}</Text>
                  <Text style={styles.bookPages}>{item.page} pages</Text>
                </View>
                <TouchableOpacity 
                  style={styles.deleteBtn}
                  onPress={() => deleteBook(item.id)}
                  disabled={loading}
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyTitle}>No books yet</Text>
                <Text style={styles.emptySubtitle}>Add your first book above!</Text>
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
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
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
    marginTop: 24,
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
  bookItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bookIconText: {
    fontSize: 20,
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
  bookAuthor: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '500',
    marginBottom: 2,
  },
  bookPages: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
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
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 8,
    marginLeft: 12,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 16,
  },
  // Add button should not fill the entire width
  addBtnContainer: {
    alignItems: 'flex-start',
    marginVertical: 16,
  },
  addBttn: {
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
  addBttnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
