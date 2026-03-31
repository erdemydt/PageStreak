import { Link, Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Animated,
    FlatList,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import BookCard from "../../../components/BookCard";
import BookStatusModal, {
    BookStatus,
} from "../../../components/BookStatusModal";
import type { EnhancedBook } from "../../../db/db";
import { execute } from "../../../db/db";
import { useBooks } from "../../../hooks/useBooks";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { TYPE } from "../../../themes/typography";
type BooksearchProps = {
  name: string;
  setName: (name: string) => void;
  author: string;
  setAuthor: (author: string) => void;
  page: string;
  setPage: (page: string) => void;
  selectedStatus: BookStatus;
  onStatusChange: (status: BookStatus) => void;
  loading: boolean;
  error: string | null;
  saveBook: () => void;
  onClose: () => void;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
};

function ManualBookEntry(props: BooksearchProps) {
  const { t } = useTranslation();
  const getStatusColor = (status: BookStatus) => {
    switch (status) {
      case "currently_reading":
        return COLORS.info;
      case "read":
        return COLORS.success;
      case "want_to_read":
        return COLORS.warning;
      default:
        return COLORS.neutral[500];
    }
  };
  const getStatusText = (status: BookStatus) => {
    switch (status) {
      case "currently_reading":
        return t("components.bookCard.currentlyReading");
      case "read":
        return t("components.bookCard.read");
      case "want_to_read":
        return t("components.bookCard.wantToRead");
      default:
        return t("components.bookCard.unknown");
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <Animated.View
        style={[
          styles.modalCard,
          {
            opacity: props.fadeAnim,
            transform: [{ scale: props.scaleAnim }],
          },
        ]}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.cardTitle}>
            {t("components.bookSearchModal.title")}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={props.onClose}
            disabled={props.loading}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={t("components.bookSearchModal.title")}
            placeholderTextColor={COLORS.neutral[400]}
            value={props.name}
            onChangeText={props.setName}
            editable={!props.loading}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder={t("components.bookSearchModal.author")}
            placeholderTextColor={COLORS.neutral[400]}
            value={props.author}
            onChangeText={props.setAuthor}
            editable={!props.loading}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder={t("components.bookSearchModal.pageCount")}
            placeholderTextColor={COLORS.neutral[400]}
            value={props.page}
            onChangeText={props.setPage}
            editable={!props.loading}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={props.saveBook}
          />

          <View style={styles.statusSelectionContainer}>
            <Text style={styles.statusSelectionLabel}>
              {t("components.bookDetailModal.status")}
            </Text>
            <View style={styles.statusButtons}>
              {(
                ["want_to_read", "currently_reading", "read"] as BookStatus[]
              ).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    props.selectedStatus === status && [
                      styles.statusButtonActive,
                      { borderColor: getStatusColor(status) },
                    ],
                  ]}
                  onPress={() => props.onStatusChange(status)}
                  disabled={props.loading}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      props.selectedStatus === status && [
                        styles.statusButtonTextActive,
                        { color: getStatusColor(status) },
                      ],
                    ]}
                  >
                    {getStatusText(status)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.saveBtn,
              (!props.name.trim() ||
                !props.author.trim() ||
                !props.page.trim() ||
                props.loading) &&
                styles.saveBtnDisabled,
            ]}
            onPress={props.saveBook}
            disabled={
              props.loading ||
              !props.name.trim() ||
              !props.author.trim() ||
              !props.page.trim()
            }
          >
            <Text style={styles.saveBtnText}>
              {props.loading ? t("booksPage.saving") : t("booksPage.addBook")}
            </Text>
          </TouchableOpacity>
        </View>
        {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
      </Animated.View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [page, setPage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddingManually, setIsAddingManually] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedBook, setSelectedBook] = useState<EnhancedBook | null>(null);
  const [statusModalFadeAnim] = useState(new Animated.Value(0));
  const [statusModalScaleAnim] = useState(new Animated.Value(0.8));
  const [manualBookStatus, setManualBookStatus] =
    useState<BookStatus>("currently_reading");
  const {
    allBooksCount,
    filterStatus,
    setFilterStatus,
    filteredBooks,
    getStatusCount,
    loadBooks,
  } = useBooks({
    onLoadingChange: setLoading,
    onLoadError: setError,
    loadErrorMessage: t("booksPage.failedToLoad"),
  });

  useEffect(() => {
    // Database is already initialized by the main app entry point
    loadBooks();
  }, [loadBooks]);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks]),
  );

  const saveManualBook = async () => {
    if (!name.trim() || !author.trim() || !page.trim() || isNaN(Number(page)))
      return;
    setLoading(true);
    setError(null);
    try {
      let dateField = "";
      let dateValue = null;

      // Set appropriate date fields based on status
      if (manualBookStatus === "currently_reading") {
        dateField = ", date_started";
        dateValue = new Date().toISOString();
      } else if (manualBookStatus === "read") {
        dateField = ", date_finished";
        dateValue = new Date().toISOString();
      }

      const query = `
        INSERT INTO enhanced_books (name, author, page, reading_status, date_added${dateField})
        VALUES (?, ?, ?, ?, ? ${dateValue ? ", ?" : ""})
      `;

      const params = [
        name.trim(),
        author.trim(),
        Number(page),
        manualBookStatus,
        new Date().toISOString(),
      ];
      if (dateValue) {
        params.push(dateValue);
      }

      await execute(query, params);

      setName("");
      setAuthor("");
      setPage("");
      setManualBookStatus("currently_reading");
      Keyboard.dismiss();
      await loadBooks();
      toggleManualForm();
    } catch (e) {
      setError(t("booksPage.failedToSave"));
      console.error("Save manual book error:", e);
    } finally {
      setLoading(false);
    }
  };

  const deleteBook = async (bookId: number, bookTitle: string) => {
    Alert.alert(
      t("booksPage.alert.deleteTitle"),
      t("booksPage.alert.deleteMessage", { title: bookTitle }),
      [
        { text: t("booksPage.alert.cancel"), style: "cancel" },
        {
          text: t("booksPage.alert.delete"),
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              await execute("DELETE FROM enhanced_books WHERE id = ?", [
                bookId,
              ]);
              await loadBooks();
            } catch (e) {
              setError("Failed to delete book");
              console.error("Delete book error:", e);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const toggleManualForm = () => {
    if (!isAddingManually) {
      setIsAddingManually(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsAddingManually(false);
        setName("");
        setAuthor("");
        setPage("");
        setManualBookStatus("currently_reading");
        setError(null);
      });
    }
  };

  const openStatusModal = (book: EnhancedBook) => {
    setSelectedBook(book);
    setStatusModalVisible(true);
    Animated.parallel([
      Animated.timing(statusModalFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(statusModalScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeStatusModal = () => {
    Animated.parallel([
      Animated.timing(statusModalFadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(statusModalScaleAnim, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStatusModalVisible(false);
      setSelectedBook(null);
    });
  };

  const handleStatusChange = async (newStatus: BookStatus) => {
    if (!selectedBook) return;

    setLoading(true);
    setError(null);

    try {
      let dateField = "";
      let dateValue = null;

      // Set appropriate date fields based on status
      if (newStatus === "currently_reading") {
        dateField = ", date_started = ?";
        dateValue = new Date().toISOString();
      } else if (newStatus === "read") {
        dateField = ", date_finished = ?";
        dateValue = new Date().toISOString();
      }

      const query = `UPDATE enhanced_books SET reading_status = ?${dateField} WHERE id = ?`;
      const params = dateValue
        ? [newStatus, dateValue, selectedBook.id]
        : [newStatus, selectedBook.id];
      // remove finished date if switching back to currently_reading or want_to_read
      if (newStatus !== "read") {
        await execute(
          "UPDATE enhanced_books SET date_finished = NULL WHERE id = ?",
          [selectedBook.id],
        );
      }
      await execute(query, params);
      await loadBooks();

      // Show success message
      const statusText =
        newStatus === "want_to_read"
          ? "Want to Read"
          : newStatus === "currently_reading"
            ? "Currently Reading"
            : "Read";

      Alert.alert(
        "Status Updated",
        `"${selectedBook.name}" has been marked as ${statusText}.`,
      );
    } catch (e) {
      setError("Failed to update book status");
      console.error("Update status error:", e);
      Alert.alert("Error", "Failed to update book status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderBook = ({
    item,
  }: {
    item: EnhancedBook & { reading_time?: number };
  }) => (
    <BookCard
      book={item}
      showDeleteButton={true}
      showStatusButton={true}
      showReadingTime={true}
      readingTimeMinutes={item.reading_time || 0}
      onPress={() =>
        router.push({
          pathname: "/(tabs)/(books)/[id]",
          params: { id: item.id.toString() },
        })
      }
      onDelete={() => deleteBook(item.id, item.name)}
      onStatusChange={() => openStatusModal(item)}
    />
  );

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: "Books" }} />
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("booksPage.title")}</Text>
            <Text style={styles.subtitle}>{t("booksPage.subtitle")}</Text>
          </View>

          {isAddingManually && (
            <ManualBookEntry
              name={name}
              setName={setName}
              author={author}
              setAuthor={setAuthor}
              page={page}
              setPage={setPage}
              selectedStatus={manualBookStatus}
              onStatusChange={setManualBookStatus}
              loading={loading}
              error={error}
              saveBook={saveManualBook}
              onClose={toggleManualForm}
              fadeAnim={fadeAnim}
              scaleAnim={scaleAnim}
            />
          )}

          <BookStatusModal
            visible={statusModalVisible}
            bookTitle={selectedBook?.name || ""}
            currentStatus={
              (selectedBook?.reading_status ||
                "currently_reading") as BookStatus
            }
            onStatusChange={handleStatusChange}
            onClose={closeStatusModal}
            fadeAnim={statusModalFadeAnim}
            scaleAnim={statusModalScaleAnim}
          />

          <View style={styles.actionButtons}>
            <Link href="./search" asChild style={styles.actionBtn}>
              <TouchableOpacity
                style={isAddingManually && styles.nonVisibleBtn}
                disabled={loading || isAddingManually}
              >
                <Text style={styles.actionBtnText}>
                  {t("booksPage.searchButton")}
                </Text>
              </TouchableOpacity>
            </Link>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.secondaryBtn,
                isAddingManually && styles.nonVisibleBtn,
              ]}
              onPress={toggleManualForm}
              disabled={loading || isAddingManually}
            >
              <Text style={[styles.actionBtnText, styles.secondaryBtnText]}>
                {t("booksPage.addBookManually")}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>
              {t("booksPage.filter.title")}
            </Text>
            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  filterStatus === "all" && styles.filterBtnActive,
                ]}
                onPress={() => setFilterStatus("all")}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    filterStatus === "all" && styles.filterBtnTextActive,
                  ]}
                >
                  {t("booksPage.filter.all")} ({allBooksCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  filterStatus === "want_to_read" && styles.filterBtnActive,
                ]}
                onPress={() => setFilterStatus("want_to_read")}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    filterStatus === "want_to_read" &&
                      styles.filterBtnTextActive,
                  ]}
                >
                  {t("booksPage.filter.want_to_read")} (
                  {getStatusCount("want_to_read")})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  filterStatus === "currently_reading" &&
                    styles.filterBtnActive,
                ]}
                onPress={() => setFilterStatus("currently_reading")}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    filterStatus === "currently_reading" &&
                      styles.filterBtnTextActive,
                  ]}
                >
                  {t("booksPage.filter.currently_reading")} (
                  {getStatusCount("currently_reading")})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  filterStatus === "read" && styles.filterBtnActive,
                ]}
                onPress={() => setFilterStatus("read")}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    filterStatus === "read" && styles.filterBtnTextActive,
                  ]}
                >
                  {t("booksPage.filter.read")} ({getStatusCount("read")})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.listSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("booksPage.listHeader.myBooks")} ({filteredBooks.length}/
                {allBooksCount})
              </Text>
              <Link href="./my-books" asChild>
                <TouchableOpacity style={styles.viewAllButton}>
                  <Text style={styles.viewAllButtonText}>
                    {t("booksPage.listHeader.viewAll")}
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
            <FlatList
              data={filteredBooks}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderBook}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📚</Text>
                  <Text style={styles.emptyTitle}>
                    {filterStatus === "all"
                      ? t("booksPage.empty.noBooks")
                      : t("booksPage.empty.noFilteredBooks", {
                          status: filterStatus.replace("_", " "),
                        })}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {filterStatus === "all"
                      ? t("booksPage.empty.searchOrAdd")
                      : t("booksPage.empty.tryChangingFilter")}
                  </Text>
                </View>
              }
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface.page,
  },
  header: {
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[4],
    paddingBottom: SPACING[3],
    alignItems: "flex-start",
  },
  title: {
    ...TYPE.pageTitle,
    marginBottom: 2,
  },
  subtitle: {
    ...TYPE.body,
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: SPACING[4],
    gap: SPACING[2],
    marginBottom: SPACING[3],
  },
  actionBtn: {
    flex: 1,
    backgroundColor: COLORS.accent.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryBtn: {
    backgroundColor: COLORS.surface.interactive,
    borderWidth: 1,
    borderColor: COLORS.accent.soft,
  },
  actionBtnText: {
    color: COLORS.text.inverse,
    fontWeight: "600",
    fontSize: 14,
  },
  secondaryBtnText: {
    color: COLORS.accent.strong,
  },
  nonVisibleBtn: {
    backgroundColor: COLORS.transparent,
    shadowOpacity: 0,
    opacity: 0,
    elevation: 0,
  },
  cardTitle: {
    ...TYPE.cardTitle,
    marginBottom: SPACING[3],
  },
  inputContainer: {
    gap: 12,
  },
  input: {
    height: 48,
    borderColor: COLORS.neutral[200],
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    fontSize: 16,
    color: COLORS.neutral[800],
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: COLORS.neutral[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 16,
  },
  error: {
    color: COLORS.danger,
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  listSection: {
    marginTop: SPACING[2],
    flex: 1,
    paddingHorizontal: SPACING[4],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text.primary,
    flex: 1,
  },
  viewAllButton: {
    backgroundColor: COLORS.surface.interactive,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewAllButtonText: {
    color: COLORS.accent.strong,
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.neutral[500],
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.neutral[400],
    textAlign: "center",
  },
  // Modal styles
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface.raised,
    width: "100%",
    maxWidth: 400,
    padding: SPACING[5],
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
    marginBottom: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.neutral[500],
  },
  statusSelectionContainer: {
    marginBottom: 16,
  },
  statusSelectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 12,
  },
  statusButtons: {
    gap: 8,
  },
  statusButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
    backgroundColor: COLORS.white,
  },
  statusButtonActive: {
    backgroundColor: COLORS.neutral[50],
    borderWidth: 2,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.neutral[500],
    textAlign: "center",
  },
  statusButtonTextActive: {
    fontWeight: "600",
  },
  filterSection: {
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[3],
    backgroundColor: COLORS.surface.raised,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginBottom: SPACING[2],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  filterButtons: {
    flexDirection: "row",
    gap: SPACING[2],
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
    backgroundColor: COLORS.surface.page,
  },
  filterBtnActive: {
    backgroundColor: COLORS.accent.soft,
    borderColor: COLORS.accent.primary,
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.text.secondary,
    textAlign: "center",
  },
  filterBtnTextActive: {
    color: COLORS.accent.strong,
    fontWeight: "600",
  },
});
