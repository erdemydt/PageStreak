import React from 'react';
import {
    Animated,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export type BookStatus = 'want_to_read' | 'currently_reading' | 'read';

interface BookStatusModalProps {
  visible: boolean;
  bookTitle: string;
  currentStatus: BookStatus;
  onStatusChange: (status: BookStatus) => void;
  onClose: () => void;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
}

export default function BookStatusModal({
  visible,
  bookTitle,
  currentStatus,
  onStatusChange,
  onClose,
  fadeAnim,
  scaleAnim,
}: BookStatusModalProps) {
  const statusOptions: Array<{
    value: BookStatus;
    label: string;
    description: string;
    emoji: string;
    color: string;
  }> = [
    {
      value: 'want_to_read',
      label: 'Want to Read',
      description: 'Add to your reading list',
      emoji: '📚',
      color: '#F59E0B',
    },
    {
      value: 'currently_reading',
      label: 'Currently Reading',
      description: 'You are reading this book',
      emoji: '📖',
      color: '#3B82F6',
    },
    {
      value: 'read',
      label: 'Read',
      description: 'You have finished this book',
      emoji: '✅',
      color: '#10B981',
    },
  ];

  const handleStatusSelect = (status: BookStatus) => {
    onStatusChange(status);
    onClose();
  };

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
            <Text style={styles.modalTitle}>Change Reading Status</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.bookTitle} numberOfLines={2}>
            {bookTitle}
          </Text>

          <View style={styles.statusOptions}>
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.statusOption,
                  currentStatus === option.value && styles.statusOptionActive,
                  { borderColor: option.color },
                ]}
                onPress={() => handleStatusSelect(option.value)}
              >
                <View style={styles.statusOptionLeft}>
                  <View
                    style={[
                      styles.statusEmoji,
                      { backgroundColor: option.color + '20' },
                    ]}
                  >
                    <Text style={styles.statusEmojiText}>{option.emoji}</Text>
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusLabel}>{option.label}</Text>
                    <Text style={styles.statusDescription}>
                      {option.description}
                    </Text>
                  </View>
                </View>
                {currentStatus === option.value && (
                  <View
                    style={[
                      styles.selectedIndicator,
                      { backgroundColor: option.color },
                    ]}
                  >
                    <Text style={styles.selectedIndicatorText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
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
    borderRadius: 20,
    padding: 24,
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
    marginBottom: 16,
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
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusOptions: {
    gap: 12,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  statusOptionActive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusEmoji: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusEmojiText: {
    fontSize: 20,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  statusDescription: {
    fontSize: 14,
    color: '#64748B',
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIndicatorText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
