import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import BookStatusModal, {
  BookStatus,
} from "../../../components/BookStatusModal";
import { execute } from "../../../db/db";
import {
  OpenLibraryService,
  SearchBookResult,
} from "../../../services/openLibrary";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { TYPE } from "../../../themes/typography";

export default function BookSearchScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchBookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<"general" | "title" | "author">(
    "general",
  );
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedBook, setSelectedBook] = useState<SearchBookResult | null>(
    null,
  );
  const [statusModalFadeAnim] = useState(new Animated.Value(0));
  const [statusModalScaleAnim] = useState(new Animated.Value(0.8));
  const [clickedSearch, setClickedSearch] = useState(false);

  const searchTypeLabels = {
    general: t("booksPage.search.general"),
    title: t("booksPage.search.title"),
    author: t("booksPage.search.author"),
  };

  useEffect(() => {
    // Reset search results when search type changes
    setClickedSearch(false);
  }, []);
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert(
        t("booksPage.search.error"),
        t("booksPage.search.enterSearchTerm"),
      );
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setClickedSearch(true);
    try {
      let results: SearchBookResult[] = [];

      switch (searchType) {
        case "title":
          results = await OpenLibraryService.searchByTitle(searchQuery.trim());
          break;
        case "author":
          results = await OpenLibraryService.searchByAuthor(searchQuery.trim());
          break;
        default:
          results = await OpenLibraryService.searchBooks(searchQuery.trim());
          break;
      }

      setSearchResults(results);

      if (results.length === 0) {
        Alert.alert(
          t("booksPage.search.noResults"),
          t("booksPage.search.noResultsMessage"),
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert(
        t("booksPage.search.error"),
        error instanceof Error
          ? error.message
          : t("booksPage.search.failedToSearchBooks"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBook = async (book: SearchBookResult) => {
    setSelectedBook(book);
    openStatusModal();
  };

  const openStatusModal = () => {
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

  const handleStatusChange = async (status: BookStatus) => {
    if (!selectedBook) return;

    try {
      const subjects = selectedBook.subjects
        ? JSON.stringify(selectedBook.subjects)
        : null;

      let dateField = "";
      let dateValue = null;

      // Set appropriate date fields based on status
      if (status === "currently_reading") {
        dateField = ", date_started";
        dateValue = new Date().toISOString();
      } else if (status === "read") {
        dateField = ", date_finished";
        dateValue = new Date().toISOString();
      }

      const query = `
        INSERT INTO enhanced_books (
          name, author, page, isbn, cover_id, cover_url,
          first_publish_year, publisher, language, subjects,
          open_library_key, author_key, rating, reading_status, date_added${dateField}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${dateValue ? ", ?" : ""})
      `;

      const params = [
        selectedBook.title,
        selectedBook.authors.join(", "),
        selectedBook.pageCount || 0,
        selectedBook.isbn || null,
        selectedBook.coverId || null,
        selectedBook.coverUrl || null,
        selectedBook.firstPublishYear || null,
        selectedBook.publisher || null,
        selectedBook.language || "eng",
        subjects,
        selectedBook.key,
        null, // author_key - would need additional processing
        selectedBook.rating || null,
        status,
        new Date().toISOString(),
      ];

      if (dateValue) {
        params.push(dateValue);
      }

      await execute(query, params);

      const statusText = t(`booksPage.search.statusLabels.${status}`);

      Alert.alert(
        t("booksPage.search.success"),
        t("booksPage.search.bookAddedMessage", {
          title: selectedBook.title,
          status: statusText,
        }),
        [
          {
            text: t("booksPage.search.ok"),
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error("Error adding book:", error);
      Alert.alert(t("error"), t("booksPage.search.failedToAddBook"));
    }
  };

  const renderBookItem = ({
    item,
    index,
  }: {
    item: SearchBookResult;
    index: number;
  }) => (
    <TouchableOpacity
      style={[
        styles.bookItem,
        index === searchResults.length - 1 && styles.lastBookItem,
      ]}
      onPress={() => handleSelectBook(item)}
    >
      <View style={styles.bookCoverContainer}>
        {item.coverUrl ? (
          <Image
            source={{ uri: item.coverUrl }}
            style={styles.bookCover}
            defaultSource={require("../../../assets/images/icon.png")}
          />
        ) : (
          <View style={styles.bookCoverPlaceholder}>
            <Text style={styles.bookCoverPlaceholderText}>📖</Text>
          </View>
        )}
      </View>

      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          {t("booksPage.search.by")} {item.authors.join(", ")}
        </Text>

        <View style={styles.bookMetadata}>
          {item.firstPublishYear && (
            <View style={styles.metadataItem}>
              <Text style={styles.metadataText}>{item.firstPublishYear}</Text>
            </View>
          )}
          {item.pageCount && (
            <View style={styles.metadataItem}>
              <Text style={styles.metadataText}>
                {item.pageCount} {t("booksPage.search.pages")}
              </Text>
            </View>
          )}
        </View>

        {item.publisher && (
          <View style={styles.publisherContainer}>
            <Text style={styles.publisherText} numberOfLines={1}>
              {item.publisher}
            </Text>
          </View>
        )}

        {item.rating && item.ratingsCount && (
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>⭐ {item.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>
              ({item.ratingsCount} {t("booksPage.search.ratings")})
            </Text>
          </View>
        )}

        {item.subjects && item.subjects.length > 0 && (
          <View style={styles.subjectsContainer}>
            {item.subjects.slice(0, 3).map((subject, index) => (
              <View key={index} style={styles.subjectTag}>
                <Text style={styles.subjectText}>{subject}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.addButtonContainer}>
        <View style={styles.addButton}>
          <Text style={styles.addButtonText}>+</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: t("booksPage.search.headerTitle"),
            headerStyle: { backgroundColor: COLORS.surface.page },
            headerTintColor: COLORS.text.primary,
            headerTitleStyle: { fontWeight: "600" },
          }}
        />

        {/* Search Header */}
        <View style={styles.searchHeader}>
          <Text style={styles.searchTitle}>
            {t("booksPage.search.searchTitle")}
          </Text>
          <Text style={styles.searchSubtitle}>
            {t("booksPage.search.searchSubtitle")}
          </Text>
        </View>

        {/* Search Type Selection */}
        <View style={styles.searchTypeContainer}>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === "general" && styles.searchTypeButtonActive,
            ]}
            onPress={() => setSearchType("general")}
          >
            <Text
              style={[
                styles.searchTypeText,
                searchType === "general" && styles.searchTypeTextActive,
              ]}
            >
              {searchTypeLabels.general}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === "title" && styles.searchTypeButtonActive,
            ]}
            onPress={() => setSearchType("title")}
          >
            <Text
              style={[
                styles.searchTypeText,
                searchType === "title" && styles.searchTypeTextActive,
              ]}
            >
              {searchTypeLabels.title}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === "author" && styles.searchTypeButtonActive,
            ]}
            onPress={() => setSearchType("author")}
          >
            <Text
              style={[
                styles.searchTypeText,
                searchType === "author" && styles.searchTypeTextActive,
              ]}
            >
              {searchTypeLabels.author}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t(`booksPage.search.placeholder`)}
            placeholderTextColor={COLORS.neutral[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.searchButton,
              loading && styles.searchButtonDisabled,
            ]}
            onPress={handleSearch}
            disabled={loading}
          >
            <Text style={styles.searchButtonText}>
              {loading
                ? t("booksPage.search.searching")
                : t("booksPage.search.searchBtn")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        <View style={styles.resultsContainer}>
          {searchResults.length > 0 && (
            <Text style={styles.resultsCount}>
              {searchResults.length === 1
                ? t("booksPage.search.foundBooks", {
                    count: searchResults.length,
                  })
                : t("booksPage.search.foundBooksPlural", {
                    count: searchResults.length,
                  })}
            </Text>
          )}

          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.key}
            renderItem={renderBookItem}
            style={styles.resultsList}
            contentContainerStyle={styles.resultsListContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !loading &&
              clickedSearch &&
              searchQuery.trim() !== "" &&
              searchResults.length === 0 ? (
                <View style={styles.emptyResults}>
                  <Ionicons
                    name="book-outline"
                    size={40}
                    color={COLORS.neutral[400]}
                    style={styles.emptyResultsIconGlyph}
                  />
                  <Text style={styles.emptyResultsText}>
                    {t("booksPage.search.noBooksfound")}
                  </Text>
                  <Text style={styles.emptyResultsSubtext}>
                    {t("booksPage.search.noResultsMessage")}
                  </Text>
                </View>
              ) : searchResults.length === 0 && !clickedSearch ? (
                <View style={styles.emptyResults}>
                  <Ionicons
                    name="search-outline"
                    size={40}
                    color={COLORS.neutral[400]}
                    style={styles.emptyResultsIconGlyph}
                  />
                  <Text style={styles.emptyResultsText}>
                    {t("booksPage.search.startSearching")}
                  </Text>
                  <Text style={styles.emptyResultsSubtext}>
                    {t("booksPage.search.startSearchingSubtext")}
                  </Text>
                </View>
              ) : null
            }
          />

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>
                {t("booksPage.search.searchingBooks")}
              </Text>
            </View>
          )}
        </View>

        <BookStatusModal
          visible={statusModalVisible}
          bookTitle={selectedBook?.title || ""}
          currentStatus="currently_reading"
          onStatusChange={handleStatusChange}
          onClose={closeStatusModal}
          fadeAnim={statusModalFadeAnim}
          scaleAnim={statusModalScaleAnim}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface.page,
  },
  searchHeader: {
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[4],
    paddingBottom: SPACING[3],
    backgroundColor: COLORS.surface.page,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[100],
  },
  searchTitle: {
    ...TYPE.sectionTitle,
    marginBottom: 2,
  },
  searchSubtitle: {
    ...TYPE.body,
  },
  searchTypeContainer: {
    flexDirection: "row",
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[3],
    paddingBottom: SPACING[2],
    gap: SPACING[2],
    backgroundColor: COLORS.surface.page,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.surface.muted,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  searchTypeButtonActive: {
    backgroundColor: COLORS.accent.soft,
    borderColor: COLORS.accent.primary,
  },
  searchTypeText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  searchTypeTextActive: {
    color: COLORS.accent.strong,
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[3],
    gap: SPACING[2],
    backgroundColor: COLORS.surface.page,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[100],
  },
  searchInput: {
    flex: 1,
    height: 46,
    borderColor: COLORS.neutral[200],
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface.raised,
    fontSize: 15,
    color: COLORS.text.primary,
  },
  searchButton: {
    backgroundColor: COLORS.accent.primary,
    paddingHorizontal: 18,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 84,
  },
  searchButtonDisabled: {
    backgroundColor: COLORS.neutral[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  searchButtonText: {
    color: COLORS.text.inverse,
    fontWeight: "600",
    fontSize: 14,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[3],
  },
  resultsCount: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: SPACING[3],
    fontWeight: "600",
  },
  resultsList: {
    flex: 1,
  },
  resultsListContent: {
    paddingBottom: 20,
  },
  bookItem: {
    flexDirection: "row",
    backgroundColor: COLORS.surface.raised,
    borderRadius: 14,
    padding: 12,
    marginBottom: SPACING[2],
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.neutral[100],
  },
  lastBookItem: {
    marginBottom: 0,
  },
  bookCoverContainer: {
    marginRight: 12,
  },
  bookCover: {
    width: 62,
    height: 92,
    borderRadius: 8,
  },
  bookCoverPlaceholder: {
    width: 62,
    height: 92,
    borderRadius: 8,
    backgroundColor: COLORS.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  bookCoverPlaceholderText: {
    fontSize: 24,
  },
  bookInfo: {
    flex: 1,
    paddingRight: 12,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
    lineHeight: 22,
  },
  bookAuthor: {
    fontSize: 14,
    color: COLORS.text.secondary,
    fontWeight: "500",
    marginBottom: 8,
  },
  bookMetadata: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  metadataItem: {
    alignItems: "center",
  },
  metadataText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  publisherContainer: {
    marginBottom: 6,
  },
  publisherText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.warning,
    marginRight: 6,
  },
  ratingCount: {
    fontSize: 12,
    color: COLORS.neutral[400],
  },
  subjectsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  subjectTag: {
    backgroundColor: COLORS.state.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subjectText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
  },
  addButtonContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent.soft,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 20,
    color: COLORS.accent.strong,
    fontWeight: "bold",
  },
  emptyResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyResultsIconGlyph: {
    marginBottom: SPACING[3],
  },
  emptyResultsText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  emptyResultsSubtext: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.neutral[500],
    marginTop: 16,
    fontWeight: "500",
  },
});
