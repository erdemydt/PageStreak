import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { queryAll, queryFirst } from '../db/db';
import { dateToLocalDateString, getTodayDateString } from '../utils/dateUtils';

interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  averageMinutesPerDay: number;
  readingDays: number;
  sessionsCount: number;
  booksRead: string[];
  dailyBreakdown: DailyStats[];
  goalProgress: number;
  streakInfo: StreakInfo;
  topBook: BookStats | null;
  readingTimeDistribution: TimeDistribution[];
}

interface DailyStats {
  date: string;
  dayName: string;
  minutes: number;
  sessions: number;
  goalMet: boolean;
}

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  streakThisWeek: number;
}

interface BookStats {
  bookName: string;
  bookAuthor: string;
  minutesRead: number;
  sessionsCount: number;
}

interface TimeDistribution {
  timeRange: string;
  minutes: number;
  percentage: number;
}

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 60;
const barMaxHeight = 120;

interface WeeklyStatsViewProps {
  weekStart: Date;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  onGoToCurrentWeek: () => void;
}

export default function WeeklyStatsView({ 
  weekStart, 
  onNavigateWeek, 
  onGoToCurrentWeek 
}: WeeklyStatsViewProps) {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(30);
  const { t } = useTranslation();

  const loadWeeklyStats = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get user's daily goal
      const userPrefs = await queryFirst<{current_reading_rate_minutes_per_day: number}>(
        'SELECT current_reading_rate_minutes_per_day FROM user_preferences WHERE id = 1'
      );
      const goalMinutes = userPrefs?.current_reading_rate_minutes_per_day || 30;
      setDailyGoal(goalMinutes);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const startDateString = dateToLocalDateString(weekStart);
      const endDateString = dateToLocalDateString(weekEnd);

      // Get all sessions for the week with book info
      const sessions = await queryAll<{
        id: number;
        book_id: number;
        minutes_read: number;
        date: string;
        created_at: string;
        notes: string;
        book_name: string;
        book_author: string;
      }>(`
        SELECT rs.*, eb.name as book_name, eb.author as book_author
        FROM reading_sessions rs
        JOIN enhanced_books eb ON rs.book_id = eb.id
        WHERE rs.date BETWEEN ? AND ?
        ORDER BY rs.date, rs.created_at
      `, [startDateString, endDateString]);

      // Calculate daily breakdown
      const dailyBreakdown = getDailyBreakdown(weekStart, sessions, goalMinutes);
      
      // Calculate total minutes
      const totalMinutes = sessions.reduce((sum, session) => sum + session.minutes_read, 0);
      
      // Calculate reading days (days with at least one session)
      const readingDaysSet = new Set(sessions.map(session => session.date));
      const readingDays = readingDaysSet.size;
      
      // Calculate average minutes per reading day (not per total days)
      const averageMinutesPerDay = readingDays > 0 ? totalMinutes / 7 : 0;
      
      // Get unique books read this week
      const uniqueBooks = [...new Set(sessions.map(session => `${session.book_name} by ${session.book_author}`))];
      
      // Calculate goal progress (weekly goal is daily goal * 7)
      const weeklyGoal = goalMinutes * 7;
      const goalProgress = weeklyGoal > 0 ? (totalMinutes / weeklyGoal) * 100 : 0;
      
      // Calculate streak info
      const streakInfo = await calculateStreakInfo(startDateString, endDateString, goalMinutes);
      
      // Find top book (most minutes read this week)
      const topBook = getTopBook(sessions);
      
      // Calculate reading time distribution
      const timeDistribution = getTimeDistribution(sessions);

      const weeklyStats: WeeklyStats = {
        weekStart: startDateString,
        weekEnd: endDateString,
        totalMinutes,
        averageMinutesPerDay,
        readingDays,
        sessionsCount: sessions.length,
        booksRead: uniqueBooks,
        dailyBreakdown,
        goalProgress,
        streakInfo,
        topBook,
        readingTimeDistribution: timeDistribution
      };

      setStats(weeklyStats);
    } catch (error) {
      console.error('Error loading weekly stats:', error);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadWeeklyStats();
  }, [loadWeeklyStats]);

  const getDailyBreakdown = (
    weekStart: Date, 
    sessions: any[], 
    goalMinutes: number
  ): DailyStats[] => {
    const dailyStats: DailyStats[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateString = dateToLocalDateString(date);
      
      const daySessions = sessions.filter(session => session.date === dateString);
      const dayMinutes = daySessions.reduce((sum, session) => sum + session.minutes_read, 0);
      
      dailyStats.push({
        date: dateString,
        dayName: getLocalizedWeekday(date),
        minutes: dayMinutes,
        sessions: daySessions.length,
        goalMet: dayMinutes >= goalMinutes
      });
    }
    
    return dailyStats;
  };

  const calculateStreakInfo = async (startDate: string, endDate: string, goalMinutes: number): Promise<StreakInfo> => {
    // Get all daily totals for streak calculation
    const dailyTotals = await queryAll<{date: string, total_minutes: number}>(`
      SELECT rs.date, SUM(rs.minutes_read) as total_minutes
      FROM reading_sessions rs
      WHERE rs.date <= ?
      GROUP BY rs.date
      ORDER BY rs.date DESC
    `, [endDate]);

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let streakThisWeek = 0;

    // Calculate current streak (from today backwards)
    const today = getTodayDateString();
    let checkDate = today;
    
    for (const day of dailyTotals) {
      if (day.date === checkDate && day.total_minutes >= goalMinutes) {
        currentStreak++;
        const checkDateObj = new Date(checkDate);
        checkDateObj.setDate(checkDateObj.getDate() - 1);
        checkDate = dateToLocalDateString(checkDateObj);
      } else {
        break;
      }
    }

    // Calculate longest streak and streak this week
    for (const day of dailyTotals) {
      if (day.total_minutes >= goalMinutes) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
        
        // Count streak days within this week
        if (day.date >= startDate && day.date <= endDate) {
          streakThisWeek++;
        }
      } else {
        tempStreak = 0;
      }
    }

    return {
      currentStreak,
      longestStreak,
      streakThisWeek
    };
  };

  const getTopBook = (sessions: any[]): BookStats | null => {
    if (sessions.length === 0) return null;

    const bookStats = sessions.reduce((acc, session) => {
      const key = `${session.book_name}|||${session.book_author}`;
      if (!acc[key]) {
        acc[key] = {
          bookName: session.book_name,
          bookAuthor: session.book_author,
          minutesRead: 0,
          sessionsCount: 0
        };
      }
      acc[key].minutesRead += session.minutes_read;
      acc[key].sessionsCount++;
      return acc;
    }, {} as Record<string, BookStats>);

    const books = Object.values(bookStats) as BookStats[];
    if (books.length === 0) return null;
    
    return books.reduce((top: BookStats, book: BookStats) => 
      book.minutesRead > top.minutesRead ? book : top
    );
  };

  const getTimeDistribution = (sessions: any[]): TimeDistribution[] => {
    const ranges = {
      'Morning (6-12)': 0,
      'Afternoon (12-17)': 0,
      'Evening (17-21)': 0,
      'Night (21-6)': 0
    };

    sessions.forEach(session => {
      const hour = new Date(session.created_at).getHours();
      if (hour >= 6 && hour < 12) {
        ranges['Morning (6-12)'] += session.minutes_read;
      } else if (hour >= 12 && hour < 17) {
        ranges['Afternoon (12-17)'] += session.minutes_read;
      } else if (hour >= 17 && hour < 21) {
        ranges['Evening (17-21)'] += session.minutes_read;
      } else {
        ranges['Night (21-6)'] += session.minutes_read;
      }
    });

    const total = Object.values(ranges).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(ranges).map(([timeRange, minutes]) => ({
      timeRange,
      minutes,
      percentage: total > 0 ? (minutes / total) * 100 : 0
    }));
  };

  const getLocalizedWeekday = (date: Date): string => {
    const dayIndex = date.getDay();
    const mondayFirstIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    return t(`components.readingLogs.weekdays.${weekdays[mondayFirstIndex]}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = t(`components.readingLogs.months.${date.toLocaleString('en', { month: 'long' }).toLowerCase()}`);
    return `${month} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}${t('components.readingLogs.minutesSuffix')}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  if (loading || !stats) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>{t('components.readingLogs.loadingText')}</Text>
      </View>
    );
  }

  const maxMinutes = Math.max(...stats.dailyBreakdown.map(day => day.minutes), dailyGoal);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity onPress={() => onNavigateWeek('prev')} style={styles.navButton}>
            <Ionicons name="chevron-back" size={20} color="#475569" />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onGoToCurrentWeek} style={styles.weekInfo}>
            <Text style={styles.weekRange}>
              {formatDate(stats.weekStart)} - {formatDate(stats.weekEnd)}
            </Text>
            <Text style={styles.weekTotal}>
              📊 {t('components.weeklyStats.weeklyAnalytics')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => onNavigateWeek('next')} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={20} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="time" size={24} color="#6C63FF" />
          </View>
          <Text style={styles.summaryValue}>{formatMinutes(stats.totalMinutes)}</Text>
          <Text style={styles.summaryLabel}>{t('components.weeklyStats.totalReading')}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="calendar" size={24} color="#10B981" />
          </View>
          <Text style={styles.summaryValue}>{stats.readingDays}/7</Text>
          <Text style={styles.summaryLabel}>{t('components.weeklyStats.activeDays')}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="flame" size={24} color="#F59E0B" />
          </View>
          <Text style={styles.summaryValue}>{stats.streakInfo.streakThisWeek}</Text>
          <Text style={styles.summaryLabel}>{t('components.weeklyStats.streakDays')}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="library" size={24} color="#EF4444" />
          </View>
          <Text style={styles.summaryValue}>{stats.booksRead.length}</Text>
          <Text style={styles.summaryLabel}>{t('components.weeklyStats.booksRead')}</Text>
        </View>
      </View>

      {/* Daily Reading Chart */}
      <View style={styles.chartSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bar-chart" size={20} color="#6C63FF" />
          <Text style={styles.sectionTitle}>{t('components.weeklyStats.dailyBreakdown')}</Text>
        </View>
        
        <View style={styles.chartContainer}>
          <View style={styles.chartArea}>
            {stats.dailyBreakdown.map((day, index) => {
              const barHeight = maxMinutes > 0 ? (day.minutes / maxMinutes) * barMaxHeight : 0;
              const goalHeight = maxMinutes > 0 ? (dailyGoal / maxMinutes) * barMaxHeight : 0;
              
              return (
                <View key={day.date} style={styles.barContainer}>
                  <View style={styles.barColumn}>
                    <Text style={styles.barValue}>{day.minutes > 0 ? ` ${day.minutes} ${t('components.readingLogs.minutesSuffix')}` : ''}</Text>
                    <View style={[styles.bar, { height: Math.max(barHeight, 4) }]}>
                      <View 
                        style={[
                          styles.barFill, 
                          { 
                            backgroundColor: day.goalMet ? '#10B981' : '#6C63FF',
                            height: '100%'
                          }
                        ]} 
                      />
                    </View>
                    {/* Goal line */}
                    <View 
                      style={[
                        styles.goalLine, 
                        { bottom: goalHeight }
                      ]} 
                    />
                  </View>
                  <Text style={styles.barLabel}>{day.dayName}</Text>
                  <View style={styles.barFooter}>
                    <Text style={styles.sessionsCount}>
                      {day.sessions > 0 ? `${day.sessions} 📝` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#6C63FF' }]} />
              <Text style={styles.legendText}>{t('components.weeklyStats.readingTime')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>{t('components.weeklyStats.goalMet')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.goalLineLegend} />
              <Text style={styles.legendText}>{t('components.weeklyStats.dailyGoal')} ({dailyGoal}m)</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Progress Stats */}
      <View style={styles.statsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="analytics" size={20} color="#6C63FF" />
          <Text style={styles.sectionTitle}>{t('components.weeklyStats.progressStats')}</Text>
        </View>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Math.round(stats.goalProgress)}%</Text>
            <Text style={styles.statLabel}>{t('components.weeklyStats.weeklyGoalProgress')}</Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min(stats.goalProgress, 100)}%` }
                ]} 
              />
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Math.round(stats.averageMinutesPerDay)}</Text>
            <Text style={styles.statLabel}>{t('components.weeklyStats.averagePerDay')}</Text>
            <Text style={styles.statNote}>
              {t('components.readingLogs.minutesSuffix')}/{t('components.weeklyStats.day')}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.streakInfo.currentStreak}</Text>
            <Text style={styles.statLabel}>{t('components.weeklyStats.currentStreak')}</Text>
            <Text style={styles.statNote}>
              {t('components.weeklyStats.days')}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.sessionsCount}</Text>
            <Text style={styles.statLabel}>{t('components.weeklyStats.totalSessions')}</Text>
            <Text style={styles.statNote}>
              {stats.sessionsCount > 0 ? Math.round(stats.totalMinutes / stats.sessionsCount) : 0}{t('components.readingLogs.minutesSuffix')}/{t('components.weeklyStats.session')}
            </Text>
          </View>
        </View>
      </View>

      {/* Top Book This Week */}
      {stats.topBook && (
        <View style={styles.topBookSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={20} color="#F59E0B" />
            <Text style={styles.sectionTitle}>{t('components.weeklyStats.topBookThisWeek')}</Text>
          </View>
          
          <View style={styles.topBookCard}>
            <View style={styles.topBookIcon}>
              <Ionicons name="book" size={32} color="#F59E0B" />
            </View>
            <View style={styles.topBookInfo}>
              <Text style={styles.topBookTitle}>{stats.topBook.bookName}</Text>
              <Text style={styles.topBookAuthor}>{t('components.readingLogs.sessionCardBy')} {stats.topBook.bookAuthor}</Text>
              <View style={styles.topBookStats}>
                <Text style={styles.topBookStat}>
                  {formatMinutes(stats.topBook.minutesRead)} • {stats.topBook.sessionsCount} {t('components.weeklyStats.sessions')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Reading Time Distribution */}
      <View style={styles.distributionSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="pie-chart" size={20} color="#8B5CF6" />
          <Text style={styles.sectionTitle}>{t('components.weeklyStats.readingTimeDistribution')}</Text>
        </View>
        
        <View style={styles.distributionChart}>
          {stats.readingTimeDistribution.map((item, index) => {
            if (item.minutes === 0) return null;
            
            return (
              <View key={index} style={styles.distributionItem}>
                <View style={styles.distributionInfo}>
                  <Text style={styles.distributionLabel}>{item.timeRange}</Text>
                  <Text style={styles.distributionValue}>
                    {formatMinutes(item.minutes)} ({Math.round(item.percentage)}%)
                  </Text>
                </View>
                <View style={styles.distributionBar}>
                  <View 
                    style={[
                      styles.distributionFill, 
                      { 
                        width: `${item.percentage}%`,
                        backgroundColor: ['#6C63FF', '#10B981', '#F59E0B', '#EF4444'][index % 4]
                      }
                    ]} 
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Insights */}
      <View style={styles.insightsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bulb" size={20} color="#06B6D4" />
          <Text style={styles.sectionTitle}>{t('components.weeklyStats.insights')}</Text>
        </View>
        
        <View style={styles.insightsContainer}>
          {stats.goalProgress >= 100 && (
            <View style={styles.insightCard}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.insightText}>
                {t('components.weeklyStats.weeklyGoalAchieved')}
              </Text>
            </View>
          )}
          
          {stats.streakInfo.currentStreak >= 7 && (
            <View style={styles.insightCard}>
              <Ionicons name="flame" size={20} color="#F59E0B" />
              <Text style={styles.insightText}>
                {t('components.weeklyStats.greatStreak', { streak: stats.streakInfo.currentStreak })}
              </Text>
            </View>
          )}
          
          {stats.readingDays >= 6 && (
            <View style={styles.insightCard}>
              <Ionicons name="star" size={20} color="#8B5CF6" />
              <Text style={styles.insightText}>
                {t('components.weeklyStats.consistentReader')}
              </Text>
            </View>
          )}
          
          {stats.booksRead.length >= 3 && (
            <View style={styles.insightCard}>
              <Ionicons name="library" size={20} color="#EC4899" />
              <Text style={styles.insightText}>
                {t('components.weeklyStats.diverseReader', { count: stats.booksRead.length })}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  weekRange: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  weekTotal: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '500',
  },
  summaryCards: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  chartSection: {
    margin: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginLeft: 8,
  },
  chartContainer: {
    alignItems: 'center',
  },
  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: barMaxHeight + 40,
    width: '100%',
    position: 'relative',
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  barColumn: {
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  barValue: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
    height: 12,
  },
  bar: {
    width: '80%',
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    minHeight: 4,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barFill: {
    borderRadius: 4,
    minHeight: 4,
  },
  goalLine: {
    position: 'absolute',
    left: '-10%',
    right: '-10%',
    height: 2,
    backgroundColor: '#F59E0B',
    borderRadius: 1,
  },
  barLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 8,
  },
  barFooter: {
    height: 16,
    justifyContent: 'center',
  },
  sessionsCount: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  goalLineLegend: {
    width: 12,
    height: 2,
    backgroundColor: '#F59E0B',
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  statsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 8,
  },
  statNote: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 2,
  },
  topBookSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  topBookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  topBookIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  topBookInfo: {
    flex: 1,
  },
  topBookTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  topBookAuthor: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  topBookStats: {
    flexDirection: 'row',
  },
  topBookStat: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  distributionSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  distributionChart: {
    gap: 12,
  },
  distributionItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  distributionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  distributionLabel: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  distributionValue: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  distributionBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  distributionFill: {
    height: '100%',
    borderRadius: 3,
  },
  insightsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  insightsContainer: {
    gap: 12,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  insightText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  bottomSpacer: {
    height: 40,
  },
});