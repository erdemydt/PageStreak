import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EnhancedBook } from '../db/db';

interface BookCardProps {
  book: EnhancedBook;
  onPress?: () => void;
  onDelete?: () => void;
  onStatusChange?: () => void;
  showDeleteButton?: boolean;
  showStatusButton?: boolean;
  showReadingTime?: boolean;
  readingTimeMinutes?: number;
  compact?: boolean;
  smaller?: boolean;
}

export default function BookCard({ 
  book, 
  onPress, 
  onDelete, 
  onStatusChange,
  showDeleteButton = false,
  showStatusButton = false,
  showReadingTime = false,
  readingTimeMinutes = 0,
  compact = false,
  smaller = false 
}: BookCardProps) {
  const formatReadingTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString();
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
    if (book.current_page && book.page && book.current_page > 0) {
      return Math.round((book.current_page / book.page) * 100);
    }
    return null;
  };

  const progress = getReadingProgress();

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={onPress}>
        <View style={styles.compactCoverContainer}>
          {book.cover_url ? (
            <Image
              source={{ uri: book.cover_url }}
              style={styles.compactCover}
              defaultSource={require('../assets/images/icon.png')}
            />
          ) : (
            <View style={styles.compactCoverPlaceholder}>
              <Text style={styles.compactCoverPlaceholderText}>📖</Text>
            </View>
          )}
        </View>
        
        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle} numberOfLines={2}>
            {book.name}
          </Text>
          <Text style={styles.compactAuthor} numberOfLines={1}>
            by {book.author}
          </Text>
          <Text style={styles.compactPages}>{book.page} pages</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (smaller) {
    return (
      <TouchableOpacity style={styles.smallerCard} onPress={onPress}>
        <View style={styles.smallerCoverContainer}>
          {book.cover_url ? (
            <Image
              source={{ uri: book.cover_url }}
              style={styles.smallerCover}
              defaultSource={require('../assets/images/icon.png')}
            />
          ) : (
            <View style={styles.smallerCoverPlaceholder}>
              <Text style={styles.smallerCoverPlaceholderText}>📖</Text>
            </View>
          )}
        </View>
        
        <View style={styles.smallerInfo}>
          <Text style={styles.smallerTitle} numberOfLines={1}>
            {book.name}
          </Text>
          <Text style={styles.smallerAuthor} numberOfLines={1}>
            by {book.author}
          </Text>
          
          <View style={styles.smallerMetadata}>
            <Text style={styles.smallerPages}>📄 {book.page}p</Text>
            {showReadingTime && readingTimeMinutes > 0 && (
              <Text style={styles.smallerReadingTime}>
                ⏱️ {formatReadingTime(readingTimeMinutes)}
              </Text>
            )}
          </View>
          
          {book.reading_status && (
            <View style={[
              styles.smallerStatusBadge, 
              { backgroundColor: getStatusColor(book.reading_status) }
            ]}>
              <Text style={styles.smallerStatusText}>
                {getStatusText(book.reading_status)}
              </Text>
            </View>
          )}
        </View>
        
        {showDeleteButton && onDelete && (
          <TouchableOpacity style={styles.smallerDeleteButton} onPress={onDelete}>
            <Text style={styles.smallerDeleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardContent}>
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
          <Text style={styles.title} numberOfLines={2}>
            {book.name}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            by {book.author}
          </Text>
          
          <View style={styles.metadata}>
            <Text style={styles.pages}>📄 {book.page} pages</Text>
            {book.first_publish_year && (
              <Text style={styles.year}>📅 {book.first_publish_year}</Text>
            )}
          </View>
          
          {book.publisher && (
            <Text style={styles.publisher} numberOfLines={1}>
              🏢 {book.publisher}
            </Text>
          )}
          
          {book.reading_status && (
            <View style={styles.statusContainer}>
              <TouchableOpacity
                style={[
                  styles.statusBadge, 
                  { backgroundColor: getStatusColor(book.reading_status) },
                  showStatusButton && styles.statusBadgeClickable
                ]}
                onPress={showStatusButton ? onStatusChange : undefined}
                disabled={!showStatusButton}
              >
                <Text style={styles.statusText}>
                  {getStatusText(book.reading_status)}
                </Text>
                {showStatusButton && (
                  <Text style={styles.statusChangeIcon}> ⏷</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          
          {showReadingTime && readingTimeMinutes > 0 && (
            <View style={styles.readingTimeContainer}>
              <Text style={styles.readingTimeText}>
                ⏱️ {formatReadingTime(readingTimeMinutes)} reading time
              </Text>
            </View>
          )}
          
          {progress !== null && book.reading_status === 'currently_reading' && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${progress}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{progress}% complete</Text>
            </View>
          )}
          
          {book.rating && (
            <View style={styles.ratingContainer}>
              <Text style={styles.rating}>⭐ {book.rating.toFixed(1)}</Text>
            </View>
          )}
          
          {book.date_finished && (
            <Text style={styles.dateFinished}>
              ✅ Finished: {formatDate(book.date_finished)}
            </Text>
          )}
        </View>
        
        {showDeleteButton && onDelete && (
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  coverContainer: {
    marginRight: 16,
  },
  cover: {
    width: 80,
    height: 120,
    borderRadius: 8,
  },
  coverPlaceholder: {
    width: 80,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 32,
  },
  bookInfo: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  author: {
    fontSize: 16,
    color: '#6C63FF',
    fontWeight: '500',
    marginBottom: 8,
  },
  metadata: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  pages: {
    fontSize: 14,
    color: '#64748B',
  },
  year: {
    fontSize: 14,
    color: '#64748B',
  },
  publisher: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  statusContainer: {
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadgeClickable: {
    paddingHorizontal: 10,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statusChangeIcon: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  ratingContainer: {
    marginBottom: 8,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  readingTimeContainer: {
    marginBottom: 8,
  },
  readingTimeText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  dateFinished: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 8,
    alignSelf: 'flex-start',
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
  },
  // Compact styles
  compactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  compactCoverContainer: {
    marginRight: 12,
  },
  compactCover: {
    width: 50,
    height: 75,
    borderRadius: 6,
  },
  compactCoverPlaceholder: {
    width: 50,
    height: 75,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactCoverPlaceholderText: {
    fontSize: 20,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  compactAuthor: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '500',
    marginBottom: 2,
  },
  compactPages: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  // Smaller styles
  smallerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  smallerCoverContainer: {
    marginRight: 10,
  },
  smallerCover: {
    width: 40,
    height: 60,
    borderRadius: 4,
  },
  smallerCoverPlaceholder: {
    width: 40,
    height: 60,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallerCoverPlaceholderText: {
    fontSize: 16,
  },
  smallerInfo: {
    flex: 1,
  },
  smallerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  smallerAuthor: {
    fontSize: 12,
    color: '#6C63FF',
    fontWeight: '500',
    marginBottom: 4,
  },
  smallerMetadata: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  smallerPages: {
    fontSize: 10,
    color: '#64748B',
  },
  smallerReadingTime: {
    fontSize: 10,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  smallerStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  smallerStatusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  smallerDeleteButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    padding: 6,
    alignSelf: 'flex-start',
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallerDeleteButtonText: {
    fontSize: 12,
  },
});
