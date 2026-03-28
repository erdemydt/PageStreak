import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { OpenLibraryService, SearchBookResult } from "../services/openLibrary";
import { COLORS } from "../themes/colors";

interface BookSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectBook: (book: SearchBookResult) => void;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
}

export default function BookSearchModal({
  visible,
  onClose,
  onSelectBook,
  fadeAnim,
  scaleAnim,
}: BookSearchModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchBookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<"general" | "title" | "author">(
    "general",
  );

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert(
        t("components.bookSearchModal.searchError"),
        t("components.bookSearchModal.enterSearchTerm"),
      );
      return;
    }

    setLoading(true);
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
          t("components.bookSearchModal.noResults"),
          t("components.bookSearchModal.noResultsFound", {
            query: searchQuery,
          }) +
            "\n\n" +
            t("components.bookSearchModal.tryDifferentSearch"),
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert(
        t("components.bookSearchModal.searchError"),
        error instanceof Error
          ? error.message
          : t("components.bookSearchModal.searchFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBook = (book: SearchBookResult) => {
    Alert.alert(
      "Add Book",
      `Do you want to add "${book.title}" by ${book.authors.join(", ")} to your library?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add Book",
          onPress: () => {
            onSelectBook(book);
            setSearchQuery("");
            setSearchResults([]);
          },
        },
      ],
    );
  };

  const renderBookItem = ({ item }: { item: SearchBookResult }) => (
    <TouchableOpacity
      style={styles.bookSearchItem}
      onPress={() => handleSelectBook(item)}
    >
      <View style={styles.bookCoverContainer}>
        {item.coverUrl ? (
          <Image
            source={{ uri: item.coverUrl }}
            style={styles.bookCover}
            defaultSource={require("../assets/images/icon.png")}
          />
        ) : (
          <View style={styles.bookCoverPlaceholder}>
            <Text style={styles.bookCoverPlaceholderText}>📖</Text>
          </View>
        )}
      </View>

      <View style={styles.bookSearchInfo}>
        <Text style={styles.bookSearchTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.bookSearchAuthor} numberOfLines={1}>
          by {item.authors.join(", ")}
        </Text>

        <View style={styles.bookMetadata}>
          {item.firstPublishYear && (
            <Text style={styles.bookMeta}>📅 {item.firstPublishYear}</Text>
          )}
          {item.pageCount && (
            <Text style={styles.bookMeta}>📄 {item.pageCount} pages</Text>
          )}
        </View>

        {item.publisher && (
          <Text style={styles.bookPublisher} numberOfLines={1}>
            🏢 {item.publisher}
          </Text>
        )}

        {item.rating && item.ratingsCount && (
          <View style={styles.ratingContainer}>
            <Text style={styles.rating}>⭐ {item.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>
              ({item.ratingsCount} ratings)
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

      <View style={styles.addIcon}>
        <Text style={styles.addIconText}>➕</Text>
      </View>
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
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
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>🔍 Search Books</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
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
              General
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
              Title
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
              Author
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={`Search by ${searchType}...`}
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
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        <View style={styles.resultsContainer}>
          {searchResults.length > 0 && (
            <Text style={styles.resultsCount}>
              Found {searchResults.length} book
              {searchResults.length !== 1 ? "s" : ""}
            </Text>
          )}

          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.key}
            renderItem={renderBookItem}
            style={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !loading &&
              searchQuery.trim() !== "" &&
              searchResults.length === 0 ? (
                <View style={styles.emptyResults}>
                  <Text style={styles.emptyResultsIcon}>📚</Text>
                  <Text style={styles.emptyResultsText}>No books found</Text>
                  <Text style={styles.emptyResultsSubtext}>
                    Try different keywords or search type
                  </Text>
                </View>
              ) : null
            }
          />

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Searching books...</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: 40,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    width: "100%",
    height: "90%",
    borderRadius: 20,
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.neutral[800],
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
  searchTypeContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.neutral[100],
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  searchTypeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  searchTypeText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.neutral[500],
  },
  searchTypeTextActive: {
    color: COLORS.white,
  },
  searchContainer: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderColor: COLORS.neutral[200],
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    fontSize: 16,
    color: COLORS.neutral[800],
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80,
  },
  searchButtonDisabled: {
    backgroundColor: COLORS.neutral[300],
  },
  searchButtonText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 16,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  resultsCount: {
    fontSize: 14,
    color: COLORS.neutral[500],
    marginBottom: 12,
    fontWeight: "500",
  },
  resultsList: {
    flex: 1,
  },
  bookSearchItem: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.neutral[100],
  },
  bookCoverContainer: {
    marginRight: 12,
  },
  bookCover: {
    width: 60,
    height: 90,
    borderRadius: 8,
  },
  bookCoverPlaceholder: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: COLORS.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  bookCoverPlaceholderText: {
    fontSize: 24,
  },
  bookSearchInfo: {
    flex: 1,
  },
  bookSearchTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 4,
  },
  bookSearchAuthor: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
    marginBottom: 6,
  },
  bookMetadata: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  bookMeta: {
    fontSize: 12,
    color: COLORS.neutral[500],
  },
  bookPublisher: {
    fontSize: 12,
    color: COLORS.neutral[500],
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  rating: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.warning,
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 11,
    color: COLORS.neutral[400],
  },
  subjectsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  subjectTag: {
    backgroundColor: COLORS.state.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subjectText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: "500",
  },
  addIcon: {
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  addIconText: {
    fontSize: 20,
  },
  emptyResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyResultsIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyResultsText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[500],
    marginBottom: 8,
  },
  emptyResultsSubtext: {
    fontSize: 14,
    color: COLORS.neutral[400],
    textAlign: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.neutral[500],
    marginTop: 12,
  },
});
