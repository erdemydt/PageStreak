import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BookStatusModal, {
  BookStatus,
} from "../../../components/BookStatusModal";
import { EnhancedBook, execute, queryFirst } from "../../../db/db";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { TYPE } from "../../../themes/typography";
import {
  getStatusColor,
  getStatusText,
  updateBookStatus,
} from "../../../utils/bookStatus";
import { parseDbDate } from "../../../utils/dateUtils";
import {
  getBookReadingTime,
  getEnhancedBookProgress,
  syncBookCurrentPageFromSessions,
} from "../../../utils/readingProgress";

export default function BookDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();

  const [book, setBook] = useState<EnhancedBook | null>(null);
  const [readingTimeMinutes, setReadingTimeMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isEditingPages, setIsEditingPages] = useState(false);
  const [pagesInput, setPagesInput] = useState("");
  const [progressData, setProgressData] = useState<{
    pagesRead: number;
    percentage: number;
    isComplete: boolean;
    source: "sessions" | "current_page" | "none";
  }>({ pagesRead: 0, percentage: 0, isComplete: false, source: "none" });

  const statusModalFadeAnim = useRef(new Animated.Value(0)).current;
  const statusModalScaleAnim = useRef(new Animated.Value(0.8)).current;

  const loadData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const numericId = Number(id);
      const foundBook = await queryFirst<EnhancedBook>(
        "SELECT * FROM enhanced_books WHERE id = ?",
        [numericId],
      );

      if (!foundBook) {
        setError(t("components.bookDetailModal.bookNotFound"));
        setBook(null);
        return;
      }

      const [readingTime, progress] = await Promise.all([
        getBookReadingTime(numericId),
        getEnhancedBookProgress(
          foundBook.id,
          foundBook.page,
          foundBook.current_page || 0,
        ),
      ]);

      setBook(foundBook);
      setReadingTimeMinutes(readingTime);
      setProgressData(progress);
    } catch (e) {
      console.error("Failed to load book details:", e);
      setError(t("booksPage.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const formatDate = (dateString: string) => {
    return parseDbDate(dateString)?.toLocaleDateString() ?? dateString;
  };

  const formatReadingTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} ${t("components.bookDetailModal.minutes")}`;
    }

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
  };

  const openStatusModal = () => {
    setShowStatusModal(true);
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

  const closeStatusModal = () => {
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

  const handleStatusChange = async (status: BookStatus) => {
    if (!book) return;

    try {
      await updateBookStatus(book.id, status);
      closeStatusModal();
      await loadData();

      Alert.alert(
        t("booksPage.alert.statusUpdated"),
        t("booksPage.alert.bookStatusUpdated", {
          statusText: getStatusText(t, status),
        }),
      );
    } catch (e) {
      console.error("Failed to update status:", e);
      Alert.alert(t("error"), t("booksPage.alert.failedUpdate"));
    }
  };

  const startEditingPages = () => {
    setPagesInput(book && book.page > 0 ? String(book.page) : "");
    setIsEditingPages(true);
  };

  const savePageCount = async () => {
    if (!book) return;

    const newPageCount = Number(pagesInput);
    if (!Number.isInteger(newPageCount) || newPageCount <= 0) {
      Alert.alert(
        t("error"),
        t("components.bookDetailModal.invalidPageCount"),
      );
      return;
    }

    try {
      await execute("UPDATE enhanced_books SET page = ? WHERE id = ?", [
        newPageCount,
        book.id,
      ]);
      // Re-derive current_page so it's capped by the new total
      await syncBookCurrentPageFromSessions(book.id);
      setIsEditingPages(false);
      await loadData();
    } catch (e) {
      console.error("Failed to update page count:", e);
      Alert.alert(t("error"), t("booksPage.failedToSave"));
    }
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={COLORS.accent.primary} />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.centerStateText}>
          {error || t("components.bookDetailModal.bookNotFound")}
        </Text>
      </View>
    );
  }

  const progress =
    book.reading_status === "currently_reading" ? progressData.percentage : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.bookHeader}>
          <View style={styles.coverContainer}>
            {book.cover_url ? (
              <Image
                source={{ uri: book.cover_url }}
                style={styles.cover}
                defaultSource={require("../../../assets/images/icon.png")}
              />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverPlaceholderText}>📖</Text>
              </View>
            )}
          </View>

          <View style={styles.bookMeta}>
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
                onPress={openStatusModal}
              >
                <Text style={styles.statusText}>
                  {getStatusText(t, book.reading_status)}
                </Text>
                <Text style={styles.statusEdit}>
                  {t("components.bookDetailModal.edit")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.quickActionPrimary]}
            onPress={openStatusModal}
          >
            <Text style={styles.quickActionPrimaryText}>
              {t("components.bookDetailModal.changeStatus")}
            </Text>
          </TouchableOpacity>

          {book.reading_status !== "read" && (
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleStatusChange("read")}
            >
              <Text style={styles.quickActionText}>
                {t("components.bookCard.read")}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push("/readinglogs")}
          >
            <Text style={styles.quickActionText}>
              {t("components.bookDetailModal.logs")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push("/my-books")}
          >
            <Text style={styles.quickActionText}>
              {t("components.bookDetailModal.library")}
            </Text>
          </TouchableOpacity>
        </View>

        {book.reading_status === "currently_reading" && progress > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("components.bookDetailModal.readingProgress")}
            </Text>
            <View style={styles.progressCard}>
              <View style={styles.progressTopRow}>
                <Text style={styles.progressValue}>{progress}%</Text>
                <Text style={styles.progressSummary}>
                  {t("components.bookDetailModal.pagesOf", {
                    pagesRead: progressData.pagesRead,
                    totalPages: book.page,
                  })}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${progress}%` }]}
                />
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("components.bookDetailModal.statistics")}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              {isEditingPages ? (
                <>
                  <TextInput
                    style={styles.pagesInput}
                    value={pagesInput}
                    onChangeText={setPagesInput}
                    keyboardType="number-pad"
                    placeholder={t(
                      "components.bookDetailModal.pageCountPlaceholder",
                    )}
                    placeholderTextColor={COLORS.neutral[400]}
                    autoFocus
                    onSubmitEditing={savePageCount}
                  />
                  <View style={styles.pagesEditActions}>
                    <TouchableOpacity onPress={() => setIsEditingPages(false)}>
                      <Text style={styles.pagesEditCancel}>
                        {t("components.bookDetailModal.cancel")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={savePageCount}>
                      <Text style={styles.pagesEditLink}>
                        {t("components.bookDetailModal.save")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.pagesValueRow}>
                    <Text style={styles.statValue}>{book.page}</Text>
                    <TouchableOpacity onPress={startEditingPages}>
                      <Text style={styles.pagesEditLink}>
                        {t("components.bookDetailModal.editPageCount")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.statLabel}>
                    {book.page > 0
                      ? t("components.bookDetailModal.totalPages")
                      : t("components.bookDetailModal.pageCountUnknown")}
                  </Text>
                </>
              )}
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatReadingTime(readingTimeMinutes)}
              </Text>
              <Text style={styles.statLabel}>
                {t("components.bookDetailModal.totalReadingTime")}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("components.bookDetailModal.bookInformation")}
          </Text>
          <View style={styles.infoCard}>
            {book.first_publish_year && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t("components.bookDetailModal.publishedDate")}
                </Text>
                <Text style={styles.infoValue}>{book.first_publish_year}</Text>
              </View>
            )}
            {book.publisher && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t("components.bookDetailModal.publisher")}
                </Text>
                <Text style={styles.infoValue}>{book.publisher}</Text>
              </View>
            )}
            {book.language && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t("components.bookDetailModal.language")}
                </Text>
                <Text style={styles.infoValue}>{book.language}</Text>
              </View>
            )}
            {book.isbn && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ISBN</Text>
                <Text style={styles.infoValue}>{book.isbn}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("components.bookDetailModal.timeline")}
          </Text>
          <View style={styles.infoCard}>
            {book.date_added && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t("components.bookDetailModal.addedToLibrary")}
                </Text>
                <Text style={styles.infoValue}>
                  {formatDate(book.date_added)}
                </Text>
              </View>
            )}
            {book.date_started && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t("components.bookDetailModal.dateStarted")}
                </Text>
                <Text style={styles.infoValue}>
                  {formatDate(book.date_started)}
                </Text>
              </View>
            )}
            {book.date_finished && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t("components.bookDetailModal.dateFinished")}
                </Text>
                <Text style={styles.infoValue}>
                  {formatDate(book.date_finished)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {book.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("components.bookDetailModal.description")}
            </Text>
            <Text style={styles.paragraph}>{book.description}</Text>
          </View>
        )}

        {book.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("components.bookDetailModal.notes")}
            </Text>
            <Text style={styles.paragraph}>{book.notes}</Text>
          </View>
        )}
      </ScrollView>

      <BookStatusModal
        visible={showStatusModal}
        bookTitle={book.name}
        currentStatus={(book.reading_status as BookStatus) || "want_to_read"}
        onStatusChange={handleStatusChange}
        onClose={closeStatusModal}
        fadeAnim={statusModalFadeAnim}
        scaleAnim={statusModalScaleAnim}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface.page,
  },
  content: {
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[4],
    paddingBottom: SPACING[6],
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.surface.page,
  },
  centerStateText: {
    ...TYPE.body,
    color: COLORS.text.secondary,
  },
  bookHeader: {
    flexDirection: "row",
    marginBottom: SPACING[4],
  },
  coverContainer: {
    marginRight: SPACING[3],
  },
  cover: {
    width: 88,
    height: 132,
    borderRadius: 10,
  },
  coverPlaceholder: {
    width: 88,
    height: 132,
    borderRadius: 10,
    backgroundColor: COLORS.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  coverPlaceholderText: {
    fontSize: 30,
  },
  bookMeta: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 6,
  },
  author: {
    ...TYPE.body,
    marginBottom: SPACING[2],
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    color: COLORS.text.inverse,
    fontSize: 12,
    fontWeight: "600",
  },
  statusEdit: {
    color: COLORS.text.inverse,
    fontSize: 11,
    opacity: 0.85,
  },
  section: {
    marginBottom: SPACING[4],
  },
  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING[2],
    marginBottom: SPACING[4],
  },
  quickActionButton: {
    backgroundColor: COLORS.surface.raised,
    borderColor: COLORS.neutral[200],
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickActionPrimary: {
    backgroundColor: COLORS.accent.soft,
    borderColor: COLORS.accent.primary,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  quickActionPrimaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.accent.strong,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: SPACING[2],
  },
  progressCard: {
    backgroundColor: COLORS.surface.raised,
    borderRadius: 12,
    padding: SPACING[3],
    borderWidth: 1,
    borderColor: COLORS.neutral[100],
  },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING[2],
  },
  progressValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.accent.strong,
  },
  progressSummary: {
    ...TYPE.meta,
    color: COLORS.text.secondary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.neutral[200],
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.accent.primary,
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING[2],
  },
  statItem: {
    flex: 1,
    backgroundColor: COLORS.surface.raised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral[100],
    padding: SPACING[3],
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    ...TYPE.meta,
    color: COLORS.text.secondary,
  },
  pagesValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  pagesInput: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
    paddingVertical: 2,
    marginBottom: 6,
  },
  pagesEditActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING[3],
  },
  pagesEditLink: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.accent.strong,
  },
  pagesEditCancel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  infoCard: {
    backgroundColor: COLORS.surface.raised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral[100],
    paddingHorizontal: SPACING[3],
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING[3],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[100],
  },
  infoLabel: {
    ...TYPE.meta,
    color: COLORS.text.secondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    color: COLORS.text.primary,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  paragraph: {
    backgroundColor: COLORS.surface.raised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral[100],
    padding: SPACING[3],
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text.secondary,
  },
});
