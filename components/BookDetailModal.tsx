import React, { useEffect, useState } from 'react';
import {
    Animated,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { EnhancedBook, queryFirst } from '../db/db';

interface BookDetailModalProps {
  visible: boolean;
  book: EnhancedBook | null;
  readingTimeMinutes?: number;
  onClose: () => void;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
}

export default function BookDetailModal({
  visible,
  book,
  readingTimeMinutes = 0,
  onClose,
  fadeAnim,
  scaleAnim,
}: BookDetailModalProps) {
  const [firstReadingDate, setFirstReadingDate] = useState<string | null>(null);

  useEffect(() => {
    if (book && visible) {
      loadFirstReadingDate();
    }
  }, [book, visible]);

  const loadFirstReadingDate = async () => {
    if (!book) return;
    
    try {
      const result = await queryFirst<{ date: string }>(
        'SELECT date FROM reading_sessions WHERE book_id = ? ORDER BY date ASC LIMIT 1',
        [book.id]
      );
      setFirstReadingDate(result?.date || "Have Not Started Reading");
    } catch (error) {
      console.error('Error loading first reading date:', error);
      setFirstReadingDate(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatReadingTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minutes`;
      }
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  };

  const getStatusColor = (status?: string) => {
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

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'currently_reading':
        return 'Currently Reading';
      case 'read':
        return 'Read';
      case 'want_to_read':
        return 'Want to Read';
      default:
        return 'Unknown';
    }
  };

  const getReadingProgress = () => {
    if (book?.current_page && book?.page && book.current_page > 0) {
      return Math.round((book.current_page / book.page) * 100);
    }
    return null;
  };

  if (!book) return null;

  const progress = getReadingProgress();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book Details</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scrollContainer} >
            <View style={styles.bookHeader}>
              <View style={styles.coverContainer}>
                
                {book.cover_url ? (
                  <Image
                    source={{ uri: book.cover_url }}
                    style={styles.cover}
                    defaultSource={require('../assets/images/icon.png')}
                  />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Text style={styles.coverPlaceholderText}>📖</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.bookInfo}>
                <Text style={styles.title}>{book.name}</Text>
                <Text style={styles.author}>by {book.author}</Text>
                
                {book.reading_status && (
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(book.reading_status) }
                  ]}>
                    <Text style={styles.statusText}>
                      {getStatusText(book.reading_status)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Reading Progress */}
            {progress !== null && book.reading_status === 'currently_reading' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📊 Reading Progress</Text>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${progress}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {book.current_page} of {book.page} pages ({progress}% complete)
                  </Text>
                </View>
              </View>
            )}

            {/* Reading Statistics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📈 Reading Statistics</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{book.page}</Text>
                  <Text style={styles.statLabel}>Total Pages</Text>
                </View>
                {readingTimeMinutes > 0 && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatReadingTime(readingTimeMinutes)}</Text>
                    <Text style={styles.statLabel}>Time Spent</Text>
                  </View>
                )}
                {firstReadingDate && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatDate(firstReadingDate)}</Text>
                    <Text style={styles.statLabel}>Started Reading</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Book Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📚 Book Information</Text>
              <View style={styles.infoGrid}>
                {book.first_publish_year && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Published:</Text>
                    <Text style={styles.infoValue}>{book.first_publish_year}</Text>
                  </View>
                )}
                {book.publisher && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Publisher:</Text>
                    <Text style={styles.infoValue}>{book.publisher}</Text>
                  </View>
                )}
                {book.language && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Language:</Text>
                    <Text style={styles.infoValue}>{book.language}</Text>
                  </View>
                )}
                {book.isbn && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>ISBN:</Text>
                    <Text style={styles.infoValue}>{book.isbn}</Text>
                  </View>
                )}
                {book.rating && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Rating:</Text>
                    <Text style={styles.infoValue}>⭐ {book.rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Description */}
            {book.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📝 Description</Text>
                <Text style={styles.description}>{book.description}</Text>
              </View>
            )}

            {/* Important Dates */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📅 Timeline</Text>
              <View style={styles.timelineContainer}>
                {book.date_added && (
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineDate}>{formatDate(book.date_added)}</Text>
                    <Text style={styles.timelineEvent}>Added to library</Text>
                  </View>
                )}
                {book.date_started && (
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineDate}>{formatDate(book.date_started)}</Text>
                    <Text style={styles.timelineEvent}>Started reading</Text>
                  </View>
                )}
                {book.date_finished && (
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineDate}>{formatDate(book.date_finished)}</Text>
                    <Text style={styles.timelineEvent}>Finished reading</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Notes */}
            {book.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🗒️ Notes</Text>
                <Text style={styles.notes}>{book.notes}</Text>
              </View>
            )}
            </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64748B',
  },
  scrollContainer: {
    paddingHorizontal: 24,
  },
  bookHeader: {
    flexDirection: 'row',
    paddingVertical: 20,
    alignItems: 'flex-start',
  },
  coverContainer: {
    marginRight: 16,
  },
  cover: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  coverPlaceholder: {
    width: 100,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 40,
  },
  bookInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    lineHeight: 26,
  },
  author: {
    fontSize: 16,
    color: '#6C63FF',
    fontWeight: '600',
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  progressContainer: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    textAlign: 'right',
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  timelineContainer: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  timelineDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C63FF',
    minWidth: 120,
  },
  timelineEvent: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
    marginLeft: 12,
  },
  notes: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    fontStyle: 'italic',
  },
});
