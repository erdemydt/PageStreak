
import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { queryAll, queryFirst } from '../../../db/db';

type Book = { id: number; name: string; author: string; page: number };
type UserPreferences = { id: number; username: string; yearly_book_goal: number };

export default function HomeScreen() {
  const [books, setBooks] = useState<Book[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);

  // Load data on mount and when screen comes into focus
  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when screen comes into focus (e.g., when returning from books tab)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      // Load user preferences
      const user = await queryFirst<UserPreferences>('SELECT * FROM user_preferences WHERE id = 1');
      setUserPreferences(user);

      // Load books
      const booksResult = await queryAll<Book>('SELECT * FROM books ORDER BY id DESC');
      setBooks(booksResult);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Calculate reading progress
  const booksRead = books.length;
  const yearlyGoal = userPreferences?.yearly_book_goal || 0;
  const progressPercentage = yearlyGoal > 0 ? Math.min((booksRead / yearlyGoal) * 100, 100) : 0;

  return (
    <>
      <Stack.Screen options={{ title: 'Home' }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📚 PageStreak</Text>
          {userPreferences && (
            <Text style={styles.subtitle}>Welcome back, {userPreferences.username}!</Text>
          )}
        </View>
        
        {/* Reading Progress Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Your Reading Progress</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{booksRead}</Text>
                <Text style={styles.statLabel}>Books Read</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{yearlyGoal}</Text>
                <Text style={styles.statLabel}>Yearly Goal</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{Math.round(progressPercentage)}%</Text>
                <Text style={styles.statLabel}>Progress</Text>
              </View>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${progressPercentage}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {booksRead >= yearlyGoal 
                  ? "🎉 Goal achieved! Amazing work!" 
                  : `${yearlyGoal - booksRead} more books to reach your goal`
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Books Section */}
        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📖 Recent Books ({books.length})</Text>
            <Link href="/books" asChild>
              <TouchableOpacity style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>See All →</Text>
              </TouchableOpacity>
            </Link>
          </View>
          
          <FlatList
            data={books.slice(0, 3)} // Show only recent 3 books
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
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyTitle}>No books yet</Text>
                <Text style={styles.emptySubtitle}>Start by adding your first book!</Text>
                <Link href="/books" asChild>
                  <TouchableOpacity style={styles.addFirstBookBtn}>
                    <Text style={styles.addFirstBookText}>Add Your First Book</Text>
                  </TouchableOpacity>
                </Link>
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
  progressContainer: {
    gap: 16,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  progressBarContainer: {
    gap: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  listSection: {
    flex: 1,
    marginTop: 24,
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
  },
  seeAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  seeAllText: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '600',
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
    paddingVertical: 40,
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
    marginBottom: 20,
  },
  addFirstBookBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFirstBookText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
