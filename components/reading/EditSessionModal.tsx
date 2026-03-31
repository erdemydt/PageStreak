import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { EnhancedBook, queryAll } from "../../db/db";
import type { SessionWithBook } from "../../hooks/useReadingSessions";
import { COLORS } from "../../themes/colors";
import { getEnhancedBookProgress } from "../../utils/readingProgress";

type EditSessionModalProps = {
  visible: boolean;
  session: SessionWithBook | null;
  onClose: () => void;
  onSave: (
    sessionId: number,
    minutes: number,
    notes: string,
    pages?: number,
  ) => Promise<void>;
  onDelete: (sessionId: number) => Promise<void>;
};

export default function EditSessionModal({
  visible,
  session,
  onClose,
  onSave,
  onDelete,
}: EditSessionModalProps) {
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState("");
  const [pages, setPages] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookData, setBookData] = useState<EnhancedBook | null>(null);
  const [remainingPages, setRemainingPages] = useState(0);

  useEffect(() => {
    const loadBookData = async () => {
      if (!session) {
        return;
      }

      try {
        const books = await queryAll<EnhancedBook>(
          "SELECT * FROM enhanced_books WHERE id = ?",
          [session.book_id],
        );

        if (books.length > 0) {
          setBookData(books[0]);
        }
      } catch (error) {
        console.error("Error loading book data:", error);
      }
    };

    if (session) {
      setMinutes(session.minutes_read.toString());
      setPages(session.pages_read ? session.pages_read.toString() : "");
      setNotes(session.notes || "");
      loadBookData();
      return;
    }

    setMinutes("");
    setPages("");
    setNotes("");
    setBookData(null);
  }, [session]);

  const calculateRemainingPages = useCallback(async () => {
    if (!bookData || !session) {
      setRemainingPages(0);
      return;
    }

    try {
      const progress = await getEnhancedBookProgress(
        bookData.id,
        bookData.page,
        bookData.current_page || 0,
      );
      const remaining = bookData.page - progress.pagesRead;
      const sessionPages = session.pages_read || 0;

      setRemainingPages(Math.max(0, remaining + sessionPages));
    } catch (error) {
      console.error("Error calculating remaining pages:", error);
      const sessionPages = session.pages_read || 0;
      setRemainingPages(
        bookData.page - (bookData.current_page || 0) + sessionPages,
      );
    }
  }, [bookData, session]);

  useEffect(() => {
    if (bookData) {
      calculateRemainingPages();
    }
  }, [bookData, calculateRemainingPages]);

  const handleSave = async () => {
    if (
      !session ||
      !minutes.trim() ||
      isNaN(Number(minutes)) ||
      Number(minutes) <= 0
    ) {
      Alert.alert(
        t("components.readingLogsEditModal.invalidInput"),
        t("components.readingLogsEditModal.enterValidMinutes"),
      );
      return;
    }

    if (pages.trim() && (isNaN(Number(pages)) || Number(pages) <= 0)) {
      Alert.alert(
        t("components.readingLogsEditModal.invalidInput"),
        t("components.readingTimeLogger.enterValidPages"),
      );
      return;
    }

    if (pages.trim() && Number(pages) > remainingPages) {
      Alert.alert(
        t("components.readingTimeLogger.tooManyPages"),
        t("components.readingTimeLogger.tooManyPagesMessage", {
          pages: Number(pages),
          remaining: remainingPages,
          bookName: bookData?.name || "Unknown Book",
        }),
      );
      return;
    }

    setLoading(true);
    try {
      const pagesValue = pages.trim() ? Number(pages) : undefined;
      await onSave(session.id, Number(minutes), notes.trim(), pagesValue);
      onClose();
    } catch {
      Alert.alert(
        t("components.readingLogsEditModal.updateError"),
        t("components.readingLogsEditModal.updateErrorMessage"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!session) {
      return;
    }

    Alert.alert(
      t("components.readingLogsEditModal.deleteConfirmTitle"),
      t("components.readingLogsEditModal.deleteConfirmMessage"),
      [
        {
          text: t("components.readingLogsEditModal.deleteConfirmCancel"),
          style: "cancel",
        },
        {
          text: t("components.readingLogsEditModal.deleteConfirmDelete"),
          style: "destructive",
          onPress: () => {
            void onDelete(session.id);
            onClose();
          },
        },
      ],
    );
  };

  if (!session) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancelText}>
              {t("components.readingLogsEditModal.cancel")}
            </Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {t("components.readingLogsEditModal.title")}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            <Text
              style={[
                styles.modalSaveText,
                loading && styles.modalSaveTextDisabled,
              ]}
            >
              {loading
                ? t("components.readingLogsEditModal.saving")
                : t("components.readingLogsEditModal.save")}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>
              {t("components.readingLogsEditModal.book")}
            </Text>
            <View style={styles.bookInfoContainer}>
              <Text style={styles.bookInfoTitle}>{session.book_name}</Text>
              <Text style={styles.bookInfoAuthor}>
                {t("components.readingLogsEditModal.by")} {session.book_author}
              </Text>
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>
              {t("components.readingLogsEditModal.readingTimeLabel")}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="numeric"
              placeholder={t(
                "components.readingLogsEditModal.readingTimePlaceholder",
              )}
            />
          </View>

          <View style={styles.modalSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.modalSectionTitle}>
                {t("components.readingTimeLogger.pagesRead")}
              </Text>
              <View style={styles.optionalBadge}>
                <Text style={styles.optionalText}>
                  {t("components.readingTimeLogger.optional")}
                </Text>
              </View>
            </View>
            {bookData && (
              <Text style={styles.sectionSubtitle}>
                {t("components.readingTimeLogger.trackPagesDescription")}
              </Text>
            )}

            {bookData && (
              <View style={styles.remainingPagesInfo}>
                <Text style={styles.remainingPagesText}>
                  {(session.pages_read || 0) > 0
                    ? t("components.readingTimeLogger.remainingPagesForEdit", {
                        remaining: remainingPages,
                        total: bookData.page,
                        current: session.pages_read || 0,
                      })
                    : t("components.readingTimeLogger.remainingPages", {
                        remaining: remainingPages,
                        total: bookData.page,
                      })}
                </Text>
              </View>
            )}

            <TextInput
              style={styles.modalInput}
              value={pages}
              onChangeText={setPages}
              keyboardType="numeric"
              placeholder={
                bookData
                  ? t("components.readingTimeLogger.enterPagesPlaceholder", {
                      max: remainingPages,
                    })
                  : t("components.readingTimeLogger.selectBookFirst")
              }
              editable={!!bookData && remainingPages > 0}
            />

            {bookData &&
              pages.trim() &&
              !isNaN(Number(pages)) &&
              Number(pages) > 0 &&
              Number(pages) <= remainingPages && (
                <View style={styles.progressPreview}>
                  <Text style={styles.progressPreviewText}>
                    {(session.pages_read || 0) > 0
                      ? t(
                          "components.readingTimeLogger.progressPreviewForEdit",
                          {
                            pages: Number(pages),
                            oldPages: session.pages_read || 0,
                            bookName: bookData.name,
                            total: bookData.page,
                          },
                        )
                      : t("components.readingTimeLogger.progressPreview", {
                          pages: Number(pages),
                          bookName: bookData.name,
                          total: bookData.page,
                        })}
                  </Text>
                </View>
              )}

            {pages.trim() && Number(pages) > remainingPages && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                  {t("components.readingTimeLogger.tooManyPagesWarning", {
                    remaining: remainingPages,
                  })}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>
              {t("components.readingLogsEditModal.notesLabel")}
            </Text>
            <TextInput
              style={[styles.modalInput, styles.modalNotesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t(
                "components.readingLogsEditModal.notesPlaceholder",
              )}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>
              {t("components.readingLogsEditModal.deleteSession")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.neutral[800],
  },
  modalCancelText: {
    fontSize: 16,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  modalSaveText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: "600",
  },
  modalSaveTextDisabled: {
    color: COLORS.neutral[300],
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
    fontWeight: "600",
    color: COLORS.neutral[700],
    marginBottom: 12,
  },
  bookInfoContainer: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  bookInfoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 4,
  },
  bookInfoAuthor: {
    fontSize: 14,
    color: COLORS.neutral[500],
  },
  modalInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.neutral[800],
  },
  modalNotesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  deleteButton: {
    backgroundColor: COLORS.dangerLight,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 32,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.state.dangerBorder,
  },
  deleteButtonText: {
    fontSize: 16,
    color: COLORS.state.dangerText,
    fontWeight: "600",
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  optionalBadge: {
    backgroundColor: COLORS.state.primarySoftAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: COLORS.state.accentCyan,
  },
  optionalText: {
    fontSize: 10,
    color: COLORS.state.accentCyan,
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.neutral[500],
    marginBottom: 12,
    lineHeight: 18,
  },
  remainingPagesInfo: {
    backgroundColor: COLORS.state.primarySoftAlt,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.state.infoBorder,
  },
  remainingPagesText: {
    fontSize: 12,
    color: COLORS.state.accentCyanDark,
    fontWeight: "500",
    textAlign: "center",
  },
  progressPreview: {
    backgroundColor: COLORS.state.primarySoftAlt,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.state.accentCyan,
    marginTop: 12,
  },
  progressPreviewText: {
    fontSize: 12,
    color: COLORS.state.accentCyanDark,
    lineHeight: 16,
    textAlign: "center",
  },
  warningContainer: {
    backgroundColor: COLORS.state.dangerSoft,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.state.dangerBorder,
    marginTop: 12,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.state.dangerText,
    lineHeight: 16,
    textAlign: "center",
    fontWeight: "500",
  },
});
