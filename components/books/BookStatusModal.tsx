import { useTranslation } from "react-i18next";
import {
    Animated,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { COLORS } from "../../themes/colors";
import { getStatusColor } from "../../utils/bookStatus";

export type BookStatus = "want_to_read" | "currently_reading" | "read";

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
  const { t } = useTranslation();

  const statusOptions: {
    value: BookStatus;
    label: string;
    description: string;
    emoji: string;
    color: string;
  }[] = [
    {
      value: "want_to_read",
      label: t("bookStatus.options.wantToRead.label"),
      description: t("bookStatus.options.wantToRead.description"),
      emoji: "📚",
      color: getStatusColor("want_to_read"),
    },
    {
      value: "currently_reading",
      label: t("bookStatus.options.currentlyReading.label"),
      description: t("bookStatus.options.currentlyReading.description"),
      emoji: "📖",
      color: getStatusColor("currently_reading"),
    },
    {
      value: "read",
      label: t("bookStatus.options.read.label"),
      description: t("bookStatus.options.read.description"),
      emoji: "✅",
      color: getStatusColor("read"),
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
            <Text style={styles.modalTitle}>{t("bookStatus.title")}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>
                {t("bookStatus.close")}
              </Text>
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
                      { backgroundColor: option.color + "20" },
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
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.neutral[800],
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.neutral[500],
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[500],
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 22,
  },
  statusOptions: {
    gap: 12,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: COLORS.white,
  },
  statusOptionActive: {
    backgroundColor: COLORS.neutral[50],
    borderWidth: 2,
  },
  statusOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusEmoji: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statusEmojiText: {
    fontSize: 18,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 2,
  },
  statusDescription: {
    fontSize: 13,
    color: COLORS.neutral[500],
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedIndicatorText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: "bold",
  },
});
