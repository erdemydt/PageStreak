
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import WeeklyStatsView from '../../../components/WeeklyStatsView';
import { EnhancedBook, execute, queryAll, ReadingSession } from '../../../db/db';
interface WeekDay {
  date: string;
  day: string;
  dayNum: number;
  isToday: boolean;
  sessions: SessionWithBook[];
  totalMinutes: number;
}

interface SessionWithBook extends ReadingSession {
  book_name: string;
  book_author: string;
}

interface EditSessionModalProps {
  visible: boolean;
  session: SessionWithBook | null;
  onClose: () => void;
  onSave: (sessionId: number, minutes: number, notes: string) => void;
  onDelete: (sessionId: number) => void;
}

const { width: screenWidth } = Dimensions.get('window');

function EditSessionModal({ visible, session, onClose, onSave, onDelete }: EditSessionModalProps) {
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (session) {
      setMinutes(session.minutes_read.toString());
      setNotes(session.notes || '');
    } else {
      setMinutes('');
      setNotes('');
    }
  }, [session]);

  const handleSave = async () => {
    if (!session || !minutes.trim() || isNaN(Number(minutes)) || Number(minutes) <= 0) {
      Alert.alert(t('components.readingLogsEditModal.invalidInput'), t('components.readingLogsEditModal.enterValidMinutes'));
      return;
    }

    setLoading(true);
    try {
      await onSave(session.id, Number(minutes), notes.trim());
      onClose();
    } catch (error) {
      Alert.alert(t('components.readingLogsEditModal.updateError'), t('components.readingLogsEditModal.updateErrorMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!session) return;
    
    Alert.alert(
      t('components.readingLogsEditModal.deleteConfirmTitle'),
      t('components.readingLogsEditModal.deleteConfirmMessage'),
      [
        { text: t('components.readingLogsEditModal.deleteConfirmCancel'), style: 'cancel' },
        {
          text: t('components.readingLogsEditModal.deleteConfirmDelete'),
          style: 'destructive',
          onPress: () => {
            onDelete(session.id);
            onClose();
          }
        }
      ]
    );
  };

  if (!session) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancelText}>{t('components.readingLogsEditModal.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{t('components.readingLogsEditModal.title')}</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            <Text style={[styles.modalSaveText, loading && styles.modalSaveTextDisabled]}>
              {loading ? t('components.readingLogsEditModal.saving') : t('components.readingLogsEditModal.save')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>{t('components.readingLogsEditModal.book')}</Text>
            <View style={styles.bookInfoContainer}>
              <Text style={styles.bookInfoTitle}>{session.book_name}</Text>
              <Text style={styles.bookInfoAuthor}>{t('components.readingLogsEditModal.by')} {session.book_author}</Text>
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>{t('components.readingLogsEditModal.readingTimeLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="numeric"
              placeholder={t('components.readingLogsEditModal.readingTimePlaceholder')}
            />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>{t('components.readingLogsEditModal.notesLabel')}</Text>
            <TextInput
              style={[styles.modalInput, styles.modalNotesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('components.readingLogsEditModal.notesPlaceholder')}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>{t('components.readingLogsEditModal.deleteSession')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// Development utility function to generate random reading data
const generateRandomReadingData = async (): Promise<void> => {
  try {
    // Check if we're in development mode
    if (!__DEV__) {
      console.log('⚠️ Random data generation is only available in development mode');
      return;
    }

    // Get currently reading books
    const currentlyReadingBooks = await queryAll<EnhancedBook>(
      `SELECT * FROM enhanced_books 
       WHERE reading_status = 'currently_reading' 
       ORDER BY date_started DESC, date_added DESC`
    );

    if (currentlyReadingBooks.length === 0) {
      Alert.alert(
        'No Currently Reading Books',
        'Please add some books with "currently reading" status first.'
      );
      return;
    }

    // Generate 20 random reading sessions
    const sessions = [];
    const today = new Date();
    
    for (let i = 0; i < 20; i++) {
      // Generate random date within the last 30 days
      const daysBack = Math.floor(Math.random() * 30);
      const sessionDate = new Date(today);
      sessionDate.setDate(today.getDate() - daysBack);
      
      // Generate random time between 1-5 PM (13:00-17:00)
      const hour = 13 + Math.floor(Math.random() * 4); // 13, 14, 15, or 16
      const minute = Math.floor(Math.random() * 60);
      sessionDate.setHours(hour, minute, 0, 0);
      
      // Random reading time between 1-20 minutes
      const minutesRead = 1 + Math.floor(Math.random() * 20);
      
      // Random book selection
      const randomBook = currentlyReadingBooks[Math.floor(Math.random() * currentlyReadingBooks.length)];
      
      // Format date as YYYY-MM-DD
      const dateString = sessionDate.toISOString().split('T')[0];
      
      // Create session with timestamp including hour
      const createdAt = sessionDate.toISOString();
      
      sessions.push({
        book_id: randomBook.id,
        minutes_read: minutesRead,
        date: dateString,
        created_at: createdAt,
        notes: null
      });
    }

    // Insert all sessions into the database
    for (const session of sessions) {
      await execute(
        `INSERT INTO reading_sessions (book_id, minutes_read, date, created_at, notes) 
         VALUES (?, ?, ?, ?, ?)`,
        [session.book_id, session.minutes_read, session.date, session.created_at, session.notes]
      );
    }

    console.log(`✅ Generated ${sessions.length} random reading sessions`);
    Alert.alert(
      'Random Data Generated',
      `Successfully added ${sessions.length} random reading sessions across different days and hours.`
    );

  } catch (error) {
    console.error('❌ Error generating random data:', error);
    Alert.alert('Error', 'Failed to generate random reading data');
  }
};

export default function ReadingLogs() {
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionWithBook | null>(null);
  
  const [isWeeklyView, setIsWeeklyView] = useState(false);
  
  const { t } = useTranslation();

  const getLocalizedWeekday = (date: Date): string => {
    const dayIndex = date.getDay();
    // Convert JavaScript day index (0=Sunday) to Monday-first array index
    // JS: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    // We want: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const mondayFirstIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    return t(`components.readingLogs.weekdays.${weekdays[mondayFirstIndex]}`);
  };

  const getLocalizedMonth = (monthIndex: number): string => {
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    return t(`components.readingLogs.months.${months[monthIndex]}`);
  };
  useFocusEffect(
    useCallback(() => {
      loadWeekData();
    }, [currentWeekStart])
  );

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    // Calculate days to subtract to get to Monday
    // If day is 0 (Sunday), subtract 6 days to get to Monday
    // If day is 1 (Monday), subtract 0 days
    // If day is 2 (Tuesday), subtract 1 day, etc.
    const diff = day === 0 ? -6 : -(day - 1);
    return new Date(d.setDate(d.getDate() + diff));
  };

  const getWeekDates = (startDate: Date): WeekDay[] => {
    const dates: WeekDay[] = [];
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      dates.push({
        date: dateString,
        day: getLocalizedWeekday(date),
        dayNum: date.getDate(),
        isToday: dateString === today,
        sessions: [],
        totalMinutes: 0
      });
    }
    return dates;
  };

  const loadWeekData = async () => {
    try {
      const weekStart = getWeekStart(currentWeekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const startDateString = weekStart.toISOString().split('T')[0];
      const endDateString = weekEnd.toISOString().split('T')[0];

      // Get all sessions for the week with book info
      const sessions = await queryAll<SessionWithBook>(`
        SELECT rs.*, eb.name as book_name, eb.author as book_author
        FROM reading_sessions rs
        JOIN enhanced_books eb ON rs.book_id = eb.id
        WHERE rs.date BETWEEN ? AND ?
        ORDER BY rs.date, rs.created_at
      `, [startDateString, endDateString]);

      // Initialize week data
      const weekDates = getWeekDates(weekStart);
      
      // Group sessions by date
      const sessionsByDate = sessions.reduce((acc, session) => {
        if (!acc[session.date]) {
          acc[session.date] = [];
        }
        acc[session.date].push(session);
        return acc;
      }, {} as Record<string, SessionWithBook[]>);

      // Add sessions to week data and calculate totals
      weekDates.forEach(day => {
        day.sessions = sessionsByDate[day.date] || [];
        day.totalMinutes = day.sessions.reduce((sum, session) => sum + session.minutes_read, 0);
      });

      setWeekData(weekDates);
    } catch (error) {
      console.error('Error loading week data:', error);
      Alert.alert(t('components.readingLogs.errorTitle'), t('components.readingLogs.errorMessage'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(new Date());
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWeekData();
  };

  const handleEditSession = (session: SessionWithBook) => {
    setSelectedSession(session);
    setEditModalVisible(true);
  };

  const handleUpdateSession = async (sessionId: number, minutes: number, notes: string) => {
    try {
      await execute(
        `UPDATE reading_sessions SET minutes_read = ?, notes = ? WHERE id = ?`,
        [minutes, notes || null, sessionId]
      );
      loadWeekData();
      Alert.alert(t('components.readingLogsEditModal.updateSuccess'), t('components.readingLogsEditModal.updateSuccessMessage'));
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    try {
      await execute(`DELETE FROM reading_sessions WHERE id = ?`, [sessionId]);
      loadWeekData();
      Alert.alert(t('components.readingLogsEditModal.deleteSuccess'), t('components.readingLogsEditModal.deleteSuccessMessage'));
    } catch (error) {
      console.error('Error deleting session:', error);
      Alert.alert(t('components.readingLogsEditModal.deleteError'), t('components.readingLogsEditModal.deleteErrorMessage'));
    }
  };

  const handleGenerateRandomData = async () => {
    try {
      await generateRandomReadingData();
      // Refresh the data after generation
      loadWeekData();
    } catch (error) {
      console.error('Error generating random data:', error);
    }
  };

  const formatDate = (date: Date) => {
    const month = getLocalizedMonth(date.getMonth());
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const weekTotal = weekData.reduce((sum, day) => sum + day.totalMinutes, 0);
  const weekStart = getWeekStart(currentWeekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  if (loading) {
    return (

      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>{t('components.readingLogs.loadingText')}</Text>
      </View>

    );
  }

  if (isWeeklyView) {
    return (
      <View style={styles.container}>
        {/* View Mode Toggle */}
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, !isWeeklyView ? styles.toggleButtonActive : undefined]}
            onPress={() => setIsWeeklyView(false)}
          >
            <Ionicons 
              name="calendar" 
              size={16} 
              color={!isWeeklyView ? '#FFFFFF' : '#64748B'} 
            />
            <Text style={[styles.toggleText, !isWeeklyView ? styles.toggleTextActive : undefined]}>
              {t('components.readingLogs.dailyView')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, isWeeklyView ? styles.toggleButtonActive : undefined]}
            onPress={() => setIsWeeklyView(true)}
          >
            <Ionicons 
              name="analytics" 
              size={16} 
              color={isWeeklyView ? '#FFFFFF' : '#64748B'} 
            />
            <Text style={[styles.toggleText, isWeeklyView ? styles.toggleTextActive : undefined]}>
              {t('components.readingLogs.analytics')}
            </Text>
          </TouchableOpacity>
        </View>
      
        <WeeklyStatsView
          weekStart={getWeekStart(currentWeekStart)}
          onNavigateWeek={navigateWeek}
          onGoToCurrentWeek={goToCurrentWeek}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* View Mode Toggle */}
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, !isWeeklyView ? styles.toggleButtonActive : undefined]}
            onPress={() => setIsWeeklyView(false)}
          >
            <Ionicons 
              name="calendar" 
              size={16} 
              color={!isWeeklyView ? '#FFFFFF' : '#64748B'} 
            />
            <Text style={[styles.toggleText, !isWeeklyView ? styles.toggleTextActive : undefined]}>
              {t('components.readingLogs.dailyView')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, isWeeklyView ? styles.toggleButtonActive : undefined]}
            onPress={() => setIsWeeklyView(true)}
          >
            <Ionicons 
              name="analytics" 
              size={16} 
              color={isWeeklyView ? '#FFFFFF' : '#64748B'} 
            />
            <Text style={[styles.toggleText, isWeeklyView ? styles.toggleTextActive : undefined]}>
              {t('components.readingLogs.analytics')}
            </Text>
          </TouchableOpacity>
        </View>      {/* Header */}
      <View style={styles.header}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={goToCurrentWeek} style={styles.weekInfo}>
            <Text style={styles.weekRange}>
              {formatDate(weekStart)} - {formatDate(weekEnd)}
            </Text>
            <Text style={styles.weekTotal}>{weekTotal} {t('components.readingLogs.minutesThisWeek')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Development Only: Random Data Button */}
      {__DEV__ && (
        <View style={styles.devButtonContainer}>
          <TouchableOpacity 
            style={styles.devButton} 
            onPress={handleGenerateRandomData}
          >
            <Ionicons name="flask" size={16} color="#FFFFFF" />
            <Text style={styles.devButtonText}>Generate Random Data (20 sessions)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Week Grid */}
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.weekGrid}>
          {weekData.map((day) => (
            <View key={day.date} style={[styles.dayCard, day.isToday && styles.todayCard]}>
              {/* Day Header */}
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName, day.isToday && styles.todayText]}>{day.day}</Text>
                <Text style={[styles.dayNumber, day.isToday && styles.todayText]}>{day.dayNum}</Text>
                <Text style={[styles.dayTotal, day.isToday && styles.todayText]}>
                  {day.totalMinutes} {t('components.readingTimeLogger.minutesShort')}
                </Text>
              </View>

              {/* Sessions */}
              <View style={styles.sessionsContainer}>
                {day.sessions.length === 0 ? (
                  <Text style={styles.noSessionsText}>{t('components.readingLogs.noSessionsText')}</Text>
                ) : (
                  day.sessions.map((session) => (
                    <TouchableOpacity
                      key={session.id}
                      style={styles.sessionCard}
                      onPress={() => handleEditSession(session)}
                    >
                      <View style={styles.sessionHeader}>
                        <Text style={styles.sessionTime}>{session.minutes_read}{t('components.readingLogs.minutesSuffix')}</Text>
                        <Text style={styles.editHint}>✏️</Text>
                      </View>
                      <Text style={styles.sessionBook} numberOfLines={2}>
                        {session.book_name}
                      </Text>
                      <Text style={styles.sessionAuthor} numberOfLines={1}>
                        {t('components.readingLogs.sessionCardBy')} {session.book_author}
                      </Text>
                      {session.notes && (
                        <Text style={styles.sessionNotes} numberOfLines={2}>
                          "{session.notes}"
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <EditSessionModal
        visible={editModalVisible}
        session={selectedSession}
        onClose={() => setEditModalVisible(false)}
        onSave={handleUpdateSession}
        onDelete={handleDeleteSession}
      />
    </View>
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
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 4,
    margin: 16,
    marginBottom: 0,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#6C63FF',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleTextActive: {
    color: '#FFFFFF',
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
  navButtonText: {
    fontSize: 18,
    color: '#475569',
    fontWeight: '600',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  weekGrid: {
    paddingVertical: 20,
    gap: 16,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  todayCard: {
    borderColor: '#6C63FF',
    backgroundColor: '#F8F7FF',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  dayTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
    flex: 1,
    textAlign: 'right',
  },
  todayText: {
    color: '#6C63FF',
  },
  sessionsContainer: {
    gap: 8,
  },
  noSessionsText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  sessionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sessionTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6C63FF',
  },
  editHint: {
    fontSize: 12,
    opacity: 0.6,
  },
  sessionBook: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  sessionAuthor: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  sessionNotes: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#6C63FF',
    fontWeight: '600',
  },
  modalSaveTextDisabled: {
    color: '#CBD5E1',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalSection: {
    marginTop: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  bookInfoContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bookInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  bookInfoAuthor: {
    fontSize: 14,
    color: '#64748B',
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  modalNotesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 32,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Development button styles
  devButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  devButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  devButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});