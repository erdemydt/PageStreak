import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Animated,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { EnhancedBook, queryFirst } from "../../db/db";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { TYPE } from "../../themes/typography";
import { getStatusColor, getStatusText } from "../../utils/bookStatus";
import { getEnhancedBookProgress } from "../../utils/readingProgress";
import BookStatusModal, { BookStatus } from "./BookStatusModal";
interface BookDetailModalProps {
  visible: boolean;
  book: EnhancedBook | null;
  readingTimeMinutes?: number;
  onClose: () => void;
  onStatusChange?: (bookId: number, status: BookStatus) => void;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
}

export default function BookDetailModal({
  visible,
  book,
  readingTimeMinutes = 0,
  onClose,
  onStatusChange,
  fadeAnim,
  scaleAnim,
}: BookDetailModalProps) {
  const { t } = useTranslation();
  // State to hold the first reading date
  const [firstReadingDate, setFirstReadingDate] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [progressData, setProgressData] = useState<{
    pagesRead: number;
    percentage: number;
    isComplete: boolean;
    source: "sessions" | "current_page" | "none";
  }>({ pagesRead: 0, percentage: 0, isComplete: false, source: "none" });

  // Animation values for status modal
  const statusModalFadeAnim = useRef(new Animated.Value(0)).current;
  const statusModalScaleAnim = useRef(new Animated.Value(0.8)).current;

  const loadProgressData = useCallback(async () => {
    if (!book) return;

    const progress = await getEnhancedBookProgress(
      book.id,
      book.page,
      book.current_page || 0,
    );
    setProgressData(progress);
  }, [book]);

  const loadFirstReadingDate = useCallback(async () => {
    if (!book) return;

    try {
      const result = await queryFirst<{ date: string }>(
        "SELECT date FROM reading_sessions WHERE book_id = ? ORDER BY date ASC LIMIT 1",
        [book.id],
      );
      setFirstReadingDate(
        result?.date || t("components.bookDetailModal.haveNotStartedReading"),
      );
    } catch (error) {
      console.error("Error loading first reading date:", error);
      setFirstReadingDate(null);
    }
  }, [book, t]);

  useEffect(() => {
    if (book && visible) {
      loadFirstReadingDate();
      loadProgressData();
    }
  }, [book, visible, loadFirstReadingDate, loadProgressData]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatReadingTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} ${t("components.bookDetailModal.minutes")}`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes > 0) {
        const hourText =
          hours > 1
            ? t("components.bookDetailModal.hours")
            : t("components.bookDetailModal.hour");
        return `${hours} ${hourText} ${remainingMinutes} ${t("components.bookDetailModal.minutes")}`;
      }
      const hourText =
        hours > 1
          ? t("components.bookDetailModal.hours")
          : t("components.bookDetailModal.hour");
      return `${hours} ${hourText}`;
    }
  };

  const getReadingProgress = () => {
    if (
      book?.reading_status === "currently_reading" &&
      progressData.percentage > 0
    ) {
      return progressData.percentage;
    }
    return null;
  };

  const handleStatusPress = () => {
    setShowStatusModal(true);
    // Animate status modal in
    Animated.parallel([
      Animated.timing(statusModalFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(statusModalScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleStatusModalClose = () => {
    // Animate status modal out
    Animated.parallel([
      Animated.timing(statusModalFadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(statusModalScaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowStatusModal(false);
    });
  };

  const handleStatusChange = (status: BookStatus) => {
    if (book && onStatusChange) {
      onStatusChange(book.id, status);
    }
    handleStatusModalClose();
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
            <Text style={styles.modalTitle}>
              {t("components.bookDetailModal.title")}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scrollContainer}>
            <View style={styles.bookHeader}>
              <View style={styles.coverContainer}>
                {book.cover_url ? (
                  <Image
                    source={{ uri: book.cover_url }}
                    style={styles.cover}
                    defaultSource={require("../../assets/images/icon.png")}
                  />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Text style={styles.coverPlaceholderText}>📖</Text>
                  </View>
                )}
              </View>

              <View style={styles.bookInfo}>
                <Text style={styles.title}>{book.name}</Text>
                <Text style={styles.author}>
                  {t("components.bookCard.by")} {book.author}
                </Text>

                {book.reading_status && (
                  <TouchableOpacity
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(book.reading_status) },
                    ]}
                    onPress={handleStatusPress}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.statusText}>
                      {getStatusText(t, book.reading_status)}
                    </Text>
                    <Text style={styles.statusChangeHint}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Reading Progress */}
            {progress !== null &&
              book.reading_status === "currently_reading" && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {t("components.bookDetailModal.readingProgress")}
                  </Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressHeader}>
                      <View style={styles.progressStats}>
                        <Text style={styles.progressPercentage}>
                          {progress}%
                        </Text>
                        <Text style={styles.progressLabel}>Complete</Text>
                      </View>
                      <View style={styles.progressStats}>
                        <Text style={styles.progressValue}>
                          {progressData.pagesRead}
                        </Text>
                        <Text style={styles.progressLabel}>Pages Read</Text>
                      </View>
                      <View style={styles.progressStats}>
                        <Text style={styles.progressValue}>
                          {book.page - progressData.pagesRead}
                        </Text>
                        <Text style={styles.progressLabel}>Remaining</Text>
                      </View>
                    </View>

                    <View style={styles.progressBarContainer}>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${progress}%` },
                            progress >= 100 && styles.progressComplete,
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.progressFooter}>
                      <Text style={styles.progressText}>
                        {progressData.pagesRead} of {book.page} pages
                      </Text>
                      {progressData.source === "sessions" && (
                        <View style={styles.trackingBadge}>
                          <Text style={styles.trackingText}>Session-based</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )}

            {/* Reading Statistics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("components.bookDetailModal.statistics")}
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{book.page}</Text>
                  <Text style={styles.statLabel}>
                    {t("components.bookDetailModal.totalPages")}
                  </Text>
                </View>
                {readingTimeMinutes > 0 && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {formatReadingTime(readingTimeMinutes)}
                    </Text>
                    <Text style={styles.statLabel}>
                      {t("components.bookDetailModal.totalReadingTime")}
                    </Text>
                  </View>
                )}
                {book.date_started && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {formatDate(firstReadingDate || book.date_started)}
                    </Text>
                    <Text style={styles.statLabel}>
                      {t("components.bookDetailModal.firstRead")}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Book Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("components.bookDetailModal.bookInformation")}
              </Text>
              <View style={styles.infoGrid}>
                {book.first_publish_year && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>
                      {t("components.bookDetailModal.publishedDate")}
                    </Text>
                    <Text style={styles.infoValue}>
                      {book.first_publish_year}
                    </Text>
                  </View>
                )}
                {book.publisher && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>
                      {t("components.bookDetailModal.publisher")}
                    </Text>
                    <Text style={styles.infoValue}>{book.publisher}</Text>
                  </View>
                )}
                {book.language && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>
                      {t("components.bookDetailModal.language")}
                    </Text>
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
                    <Text style={styles.infoLabel}>
                      {t("components.bookDetailModal.rating")}
                    </Text>
                    <Text style={styles.infoValue}>
                      {book.rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Description */}
            {book.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("components.bookDetailModal.description")}
                </Text>
                <Text style={styles.description}>{book.description}</Text>
              </View>
            )}

            {/* Important Dates */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("components.bookDetailModal.timeline")}
              </Text>
              <View style={styles.timelineContainer}>
                {book.date_added && (
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineDate}>
                      {formatDate(book.date_added)}
                    </Text>
                    <Text style={styles.timelineEvent}>
                      {t("components.bookDetailModal.addedToLibrary")}
                    </Text>
                  </View>
                )}
                {book.date_started && (
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineDate}>
                      {formatDate(book.date_started)}
                    </Text>
                    <Text style={styles.timelineEvent}>
                      {t("components.bookDetailModal.dateStarted")}
                    </Text>
                  </View>
                )}
                {book.date_finished && (
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineDate}>
                      {formatDate(book.date_finished)}
                    </Text>
                    <Text style={styles.timelineEvent}>
                      {t("components.bookDetailModal.dateFinished")}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Notes */}
            {book.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("components.bookDetailModal.notes")}
                </Text>
                <Text style={styles.notes}>{book.notes}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>

      {/* Book Status Modal */}
      <BookStatusModal
        visible={showStatusModal}
        bookTitle={book?.name || ""}
        currentStatus={(book?.reading_status as BookStatus) || "want_to_read"}
        onStatusChange={handleStatusChange}
        onClose={handleStatusModalClose}
        fadeAnim={statusModalFadeAnim}
        scaleAnim={statusModalScaleAnim}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING[4],
  },
  modalContainer: {
    backgroundColor: COLORS.surface.raised,
    width: "100%",
    maxWidth: 400,
    maxHeight: "88%",
    borderRadius: 16,
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
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[5],
    paddingBottom: SPACING[3],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[100],
  },
  modalTitle: {
    ...TYPE.cardTitle,
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
  scrollContainer: {
    paddingHorizontal: SPACING[5],
  },
  bookHeader: {
    flexDirection: "row",
    paddingVertical: SPACING[4],
    alignItems: "flex-start",
  },
  coverContainer: {
    marginRight: SPACING[3],
  },
  cover: {
    width: 84,
    height: 126,
    borderRadius: 8,
  },
  coverPlaceholder: {
    width: 84,
    height: 126,
    borderRadius: 8,
    backgroundColor: COLORS.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  coverPlaceholderText: {
    fontSize: 34,
  },
  bookInfo: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 6,
    lineHeight: 22,
  },
  author: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: "500",
    marginBottom: 10,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: "600",
  },
  statusChangeHint: {
    fontSize: 11,
    color: COLORS.white,
    opacity: 0.8,
    fontWeight: "600",
  },
  section: {
    marginBottom: SPACING[4],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.secondary,
    marginBottom: SPACING[2],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  progressContainer: {
    backgroundColor: COLORS.surface.muted,
    padding: SPACING[4],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  progressStats: {
    alignItems: "center",
    flex: 1,
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.accent.strong,
    marginBottom: 2,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.neutral[800],
    marginBottom: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.neutral[500],
    fontWeight: "500",
    textAlign: "center",
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.neutral[200],
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent.primary,
    borderRadius: 999,
  },
  progressComplete: {
    backgroundColor: COLORS.success,
  },
  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: {
    fontSize: 12,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  trackingBadge: {
    backgroundColor: COLORS.state.infoSoft,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.info,
  },
  trackingText: {
    fontSize: 10,
    color: COLORS.state.infoStrong,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statItem: {
    backgroundColor: COLORS.surface.muted,
    padding: 12,
    borderRadius: 10,
    flex: 1,
    minWidth: 100,
    alignItems: "center",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.neutral[800],
    marginBottom: 4,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.neutral[500],
    textAlign: "center",
  },
  infoGrid: {
    gap: 8,
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[100],
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.neutral[500],
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.neutral[800],
    flex: 1,
    textAlign: "right",
  },
  description: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 20,
    backgroundColor: COLORS.surface.muted,
    padding: 12,
    borderRadius: 10,
  },
  timelineContainer: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  timelineDate: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.accent.strong,
    minWidth: 120,
  },
  timelineEvent: {
    fontSize: 13,
    color: COLORS.neutral[500],
    flex: 1,
    marginLeft: 12,
  },
  notes: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 20,
    backgroundColor: COLORS.surface.muted,
    padding: 12,
    borderRadius: 10,
    fontStyle: "italic",
  },
});
