
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
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
import { ReadingSession, execute, queryAll } from '../../../db/db';

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
      Alert.alert('Invalid Input', 'Please enter a valid number of minutes');
      return;
    }

    setLoading(true);
    try {
      await onSave(session.id, Number(minutes), notes.trim());
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to update session');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!session) return;
    
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this reading session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Session</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            <Text style={[styles.modalSaveText, loading && styles.modalSaveTextDisabled]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Book</Text>
            <View style={styles.bookInfoContainer}>
              <Text style={styles.bookInfoTitle}>{session.book_name}</Text>
              <Text style={styles.bookInfoAuthor}>by {session.book_author}</Text>
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Reading Time (minutes)</Text>
            <TextInput
              style={styles.modalInput}
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="numeric"
              placeholder="Enter minutes"
            />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Notes</Text>
            <TextInput
              style={[styles.modalInput, styles.modalNotesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes about your reading session"
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>🗑️ Delete Session</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ReadingLogs() {
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionWithBook | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadWeekData();
    }, [currentWeekStart])
  );

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Get Monday as start of week
    return new Date(d.setDate(diff));
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
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
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
      Alert.alert('Error', 'Failed to load reading logs');
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
      Alert.alert('Success', 'Session updated successfully');
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    try {
      await execute(`DELETE FROM reading_sessions WHERE id = ?`, [sessionId]);
      loadWeekData();
      Alert.alert('Success', 'Session deleted successfully');
    } catch (error) {
      console.error('Error deleting session:', error);
      Alert.alert('Error', 'Failed to delete session');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const weekTotal = weekData.reduce((sum, day) => sum + day.totalMinutes, 0);
  const weekStart = getWeekStart(currentWeekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading reading logs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={goToCurrentWeek} style={styles.weekInfo}>
            <Text style={styles.weekRange}>
              {formatDate(weekStart)} - {formatDate(weekEnd)}
            </Text>
            <Text style={styles.weekTotal}>{weekTotal} minutes this week</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

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
                  {day.totalMinutes}m
                </Text>
              </View>

              {/* Sessions */}
              <View style={styles.sessionsContainer}>
                {day.sessions.length === 0 ? (
                  <Text style={styles.noSessionsText}>No reading sessions</Text>
                ) : (
                  day.sessions.map((session) => (
                    <TouchableOpacity
                      key={session.id}
                      style={styles.sessionCard}
                      onPress={() => handleEditSession(session)}
                    >
                      <View style={styles.sessionHeader}>
                        <Text style={styles.sessionTime}>{session.minutes_read}m</Text>
                        <Text style={styles.editHint}>✏️</Text>
                      </View>
                      <Text style={styles.sessionBook} numberOfLines={2}>
                        {session.book_name}
                      </Text>
                      <Text style={styles.sessionAuthor} numberOfLines={1}>
                        by {session.book_author}
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
});