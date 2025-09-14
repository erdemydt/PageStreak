
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import BookCard from '../../../components/BookCard';
import DailyProgressCard from '../../../components/DailyProgressCard';
import ReadingTimeLogger from '../../../components/ReadingTimeLogger';
import { EnhancedBook, queryAll, queryFirst } from '../../../db/db';
import { getReadingStreak, getTodayReadingMinutes, initializeReadingSessions } from '../../../utils/readingProgress';

type UserPreferences = {
  id: number;
  username: string;
  yearly_book_goal: number;
  preferred_genres?: string;
  created_at?: string;
  updated_at?: string;
  current_reading_rate_minutes_per_day?: number;
};

type ReadingSession = {
  id: number;
  book_id: number;
  minutes_read: number;
  date: string;
  created_at: string;
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const [books, setBooks] = useState<EnhancedBook[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReadingLogger, setShowReadingLogger] = useState(false);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [readingStreak, setReadingStreak] = useState(0);

  // Load data on mount and when screen comes into focus
  useEffect(() => {
    initializeApp();
  }, []);

  // Refresh data when screen comes into focus (e.g., when returning from books tab)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const initializeApp = async () => {
    await initializeReadingSessions();
    loadData();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load user preferences
      const user = await queryFirst<UserPreferences>('SELECT * FROM user_preferences WHERE id = 1');
      setUserPreferences(user);

      // Load today's reading progress
      await loadTodayProgress();

      // Load reading streak
      await loadReadingStreak();

      // Load books - try enhanced books first, fallback to regular books
      try {
        const enhancedBooks = await queryAll<EnhancedBook>('SELECT * FROM enhanced_books ORDER BY date_added DESC');
        setBooks(enhancedBooks);
      } catch (e) {
        // Fallback to regular books table
        try {
          const regularBooks = await queryAll<{ id: number, name: string, author: string, page: number }>('SELECT * FROM books ORDER BY id DESC');
          const mappedBooks: EnhancedBook[] = regularBooks.map(book => ({
            ...book,
            reading_status: 'read' as const,
            date_added: new Date().toISOString(),
            current_page: book.page,
          }));
          setBooks(mappedBooks);
        } catch (bookError) {
          console.log('No books table found');
          setBooks([]);
        }
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayProgress = async () => {
    try {
      const minutes = await getTodayReadingMinutes();
      setTodayMinutes(minutes);
    } catch (e) {
      console.error('Error loading today progress:', e);
      setTodayMinutes(0);
    }
  };

  const loadReadingStreak = async () => {
    try {
      // Get the user's daily goal with fallback for missing columns
      let user;
      let dailyGoal = 30; // Default fallback
      
      try {
        user = await queryFirst<UserPreferences>('SELECT current_reading_rate_minutes_per_day FROM user_preferences WHERE id = 1');
        dailyGoal = user?.current_reading_rate_minutes_per_day || 30;
      } catch (columnError) {
        // If the column doesn't exist, fall back to basic user check
        console.log('📝 current_reading_rate_minutes_per_day column not found, using default goal');
        try {
          const basicUser = await queryFirst<UserPreferences>('SELECT id FROM user_preferences WHERE id = 1');
          if (!basicUser) {
            // No user exists yet
            setReadingStreak(0);
            return;
          }
        } catch (error) {
          console.log('📝 user_preferences table not found, using default streak');
          setReadingStreak(0);
          return;
        }
      }

      const streak = await getReadingStreak(dailyGoal);
      setReadingStreak(streak);
    } catch (e) {
      console.error('Error calculating reading streak:', e);
      setReadingStreak(0);
    }
  };

  // Calculate reading progress - only count 'read' books
  const booksRead = books.filter(book => book.reading_status === 'read').length;
  const currentlyReading = books.filter(book => book.reading_status === 'currently_reading').length;
  const wantToRead = books.filter(book => book.reading_status === 'want_to_read').length;
  const yearlyGoal = userPreferences?.yearly_book_goal || 0;
  const progressPercentage = yearlyGoal > 0 ? Math.min((booksRead / yearlyGoal) * 100, 100) : 0;

  const renderBook = ({ item }: { item: EnhancedBook }) => (
    <BookCard book={item} compact={true} />
  );

  const handleReadingLoggerSuccess = () => {
    loadTodayProgress();
    loadReadingStreak();
  };
  const topPart = () => 
     (

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>

        <View style={styles.header}>
          <Text style={styles.title}>{t('home.title')}</Text>
          {userPreferences && (
            <Text style={styles.subtitle}>{t('home.welcomeBack', { username: userPreferences.username })}</Text>
          )}
        </View>

        {/* Daily Reading Progress Card */}
        <DailyProgressCard
          todayMinutes={todayMinutes}
          goalMinutes={userPreferences?.current_reading_rate_minutes_per_day || 30}
          streakDays={readingStreak}
        />

        {/* Log Reading Time Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.logTimeButton}
            onPress={() => setShowReadingLogger(true)}
          >
            <Text style={styles.logTimeButtonText}>{t('home.logReadingTime')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 12, alignItems: 'center' }}>
            <Link href={"/readinglogs"} >
              <Text style={{ color: '#6C63FF', fontWeight: '600' }}>{t('home.viewReadingLogs')}</Text>
            </Link>
          </TouchableOpacity>

        </View>

        {/* Reading Progress Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('home.readingJourney')}</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{booksRead}</Text>
                <Text style={styles.statLabel}>{t('home.booksRead')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{currentlyReading}</Text>
                <Text style={styles.statLabel}>{t('home.reading')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{wantToRead}</Text>
                <Text style={styles.statLabel}>{t('home.wantToRead')}</Text>
              </View>
            </View>

            {yearlyGoal > 0 && (
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
                    ? t('home.goalAchieved')
                    : t('home.goalProgress', { remaining: yearlyGoal - booksRead, goal: yearlyGoal })
                  }
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Recent Books Section */}
        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.recentBooks', { count: books.length })}</Text>
            <Link href={"/(books)" as any} asChild>
              <TouchableOpacity style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    )
  const TopPart = topPart;

  return (

    <View style={styles.container}>
      <FlatList
        data={books.slice(0, 4)} // Show only recent 4 books
        keyExtractor={item => item.id.toString()}
        renderItem={renderBook}
        ListHeaderComponent={<TopPart />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>{t('home.noBooksYet')}</Text>
            <Text style={styles.emptySubtitle}>{t('home.startDiscovering')}</Text>
            <Link href={"/(books)" as any} asChild>
              <TouchableOpacity style={styles.addFirstBookBtn}>
                <Text style={styles.addFirstBookText}>{t('home.discoverBooks')}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        }
        style={styles.list}
        showsVerticalScrollIndicator={false}
      />
      {/* Reading Time Logger Modal */}
      <ReadingTimeLogger
        visible={showReadingLogger}
        onClose={() => setShowReadingLogger(false)}
        onSuccess={handleReadingLoggerSuccess}
      />
    </View>
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
  actionContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  logTimeButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logTimeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
