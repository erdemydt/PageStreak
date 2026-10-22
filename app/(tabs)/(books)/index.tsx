import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import BookStatusModal, {
  BookStatus,
} from "../../../components/BookStatusModal";
import LibraryRow from "../../../components/book/LibraryRow";
import Button from "../../../components/ui/Button";
import Chip from "../../../components/ui/Chip";
import Eyebrow from "../../../components/ui/Eyebrow";
import Hairline from "../../../components/ui/Hairline";
import OptionSheet from "../../../components/ui/OptionSheet";
import Screen from "../../../components/ui/Screen";
import { SHEET_HANDOFF_MS } from "../../../components/ui/Sheet";
import { useSessionSheets } from "../../../contexts/SessionSheetsContext";
import {
  BookWithStats,
  deleteBookWithSessions,
  listBooksWithStats,
} from "../../../db/repos/books";
import { useBookStatusChange } from "../../../hooks/useBookStatusChange";
import { useFocusRefresh } from "../../../hooks/useFocusRefresh";
import { COLORS } from "../../../themes/colors";
import { RADIUS, SPACING } from "../../../themes/spacing";
import { FONTS, TYPE } from "../../../themes/typography";
import { parseDbDate } from "../../../utils/dateUtils";
import { computeBookProgress } from "../../../utils/readingProgress";
import { showToast } from "../../../utils/toast";

type Filter = BookStatus | "all";
type SortKey = "recent" | "title" | "author" | "time" | "progress";

const FILTERS: Filter[] = ["all", "currently_reading", "want_to_read", "read"];
const SECTION_ORDER: BookStatus[] = ["currently_reading", "want_to_read", "read"];

const compareText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

const SORTS: Record<SortKey, (a: BookWithStats, b: BookWithStats) => number> = {
  recent: (a, b) =>
    (parseDbDate(b.date_added)?.getTime() ?? 0) -
    (parseDbDate(a.date_added)?.getTime() ?? 0),
  title: (a, b) => compareText(a.name, b.name),
  // Books without an author (manual adds) go last
  author: (a, b) =>
    !a.author !== !b.author
      ? a.author
        ? -1
        : 1
      : compareText(a.author || "", b.author || ""),
  time: (a, b) => (b.reading_time || 0) - (a.reading_time || 0),
  progress: (a, b) =>
    computeBookProgress(b).percentage - computeBookProgress(a).percentage,
};

/**
 * The one library: search, status filter, sort. "+" opens the Add book sheet;
 * long-press a book for its status and delete.
 */
export default function LibraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { openAddBook } = useSessionSheets();
  const setBookStatus = useBookStatusChange();

  const [books, setBooks] = useState<BookWithStats[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [menuBook, setMenuBook] = useState<BookWithStats | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setBooks(await listBooksWithStats());
      setError(false);
    } catch (e) {
      console.error("Load books error:", e);
      setError(true);
    } finally {
      setLoaded(true);
    }
  }, []);
  useFocusRefresh(load, ["books", "sessions"]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: books.length,
      currently_reading: 0,
      want_to_read: 0,
      read: 0,
    };
    books.forEach((b) => {
      const status = b.reading_status as BookStatus;
      if (status in c) c[status] += 1;
    });
    return c;
  }, [books]);

  const sections = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const matching = books
      .filter((b) => filter === "all" || b.reading_status === filter)
      .filter(
        (b) =>
          !q ||
          b.name.toLocaleLowerCase().includes(q) ||
          (b.author || "").toLocaleLowerCase().includes(q),
      )
      .sort(SORTS[sort]);
    if (filter !== "all") {
      return matching.length ? [{ key: filter, data: matching }] : [];
    }
    return SECTION_ORDER.map((status) => ({
      key: status,
      data: matching.filter((b) => b.reading_status === status),
    })).filter((s) => s.data.length > 0);
  }, [books, filter, query, sort]);

  const filterLabels: Record<Filter, string> = {
    all: t("library.all"),
    currently_reading: t("library.reading"),
    want_to_read: t("library.wantToRead"),
    read: t("library.read"),
  };
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "recent", label: t("library.sort.recent") },
    { key: "title", label: t("library.sort.title") },
    { key: "author", label: t("library.sort.author") },
    { key: "time", label: t("library.sort.time") },
    { key: "progress", label: t("library.sort.progress") },
  ];
  const sortLabel = sortOptions.find((o) => o.key === sort)?.label ?? "";

  const openBook = (book: BookWithStats) =>
    router.push({
      pathname: "/(tabs)/(books)/[id]",
      params: { id: String(book.id) },
    });

  const confirmDelete = (book: BookWithStats) => {
    Alert.alert(
      t("booksPage.alert.deleteTitle"),
      t("booksPage.alert.deleteWithSessionsMessage", { title: book.name }),
      [
        { text: t("booksPage.alert.cancel"), style: "cancel" },
        {
          text: t("booksPage.alert.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteBookWithSessions(book.id);
              showToast({ message: t("bookPage.deleted", { title: book.name }) });
            } catch (e) {
              console.error("Delete book error:", e);
              Alert.alert(t("error"), t("booksPage.alert.failedDelete"));
            }
          },
        },
      ],
    );
  };

  const header = (
    <Stack.Screen
      options={{
        title: t("navigation.books"),
        headerRight: () => (
          <Pressable
            onPress={() => openAddBook()}
            accessibilityRole="button"
            accessibilityLabel={t("addBook.title")}
            hitSlop={12}
            style={styles.headerButton}
          >
            <Ionicons name="add" size={28} color={COLORS.ink.primary} />
          </Pressable>
        ),
      }}
    />
  );

  if (loaded && books.length === 0 && !error) {
    return (
      <Screen>
        {header}
        <View style={styles.emptyLibrary}>
          <Text style={styles.emptyTitle}>{t("library.emptyTitle")}</Text>
          <Text style={styles.emptyText}>{t("library.emptyHint")}</Text>
          <Button
            title={t("addBook.title")}
            icon="add"
            onPress={() => openAddBook()}
          />
        </View>
      </Screen>
    );
  }

  const resultCount = sections.reduce((n, s) => n + s.data.length, 0);

  return (
    <Screen>
      {header}
      <SectionList
        sections={sections}
        keyExtractor={(book) => String(book.id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.controls}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={COLORS.ink.secondary} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t("library.searchPlaceholder")}
                placeholderTextColor={COLORS.ink.disabled}
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel={t("library.searchPlaceholder")}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {FILTERS.map((f) => (
                <Chip
                  key={f}
                  label={`${filterLabels[f]} ${counts[f]}`}
                  selected={filter === f}
                  onPress={() => setFilter(f)}
                />
              ))}
            </ScrollView>
            <View style={styles.summaryRow}>
              <Text style={styles.summary}>
                {t(
                  resultCount === 1
                    ? "booksPage.empty.bookCountOne"
                    : "booksPage.empty.bookCountOther",
                  { count: resultCount },
                )}
              </Text>
              <Pressable
                onPress={() => setSortOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("library.sortedBy", { sort: sortLabel })}
                hitSlop={8}
                style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
              >
                <Text style={styles.sortText}>{sortLabel}</Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.ink.secondary} />
              </Pressable>
            </View>
            {error && <Text style={styles.error}>{t("booksPage.failedToLoad")}</Text>}
          </View>
        }
        renderSectionHeader={({ section }) =>
          filter === "all" ? (
            <Eyebrow style={styles.sectionHeader}>
              {`${filterLabels[section.key as Filter]} · ${section.data.length}`}
            </Eyebrow>
          ) : null
        }
        ItemSeparatorComponent={Hairline}
        renderItem={({ item }) => (
          <LibraryRow
            book={item}
            onPress={() => openBook(item)}
            onLongPress={() => {
              setMenuBook(item);
              setMenuOpen(true);
            }}
          />
        )}
        ListEmptyComponent={
          loaded ? (
            <Text style={styles.noMatch}>
              {query.trim()
                ? t("library.noMatch", { query: query.trim() })
                : t("library.noneInFilter")}
            </Text>
          ) : null
        }
      />

      <OptionSheet
        visible={sortOpen}
        title={t("library.sortTitle")}
        options={sortOptions}
        selected={sort}
        onSelect={setSort}
        onClose={() => setSortOpen(false)}
      />
      <BookStatusModal
        visible={menuOpen}
        bookTitle={menuBook?.name ?? ""}
        currentStatus={(menuBook?.reading_status as BookStatus) ?? "want_to_read"}
        onStatusChange={(status) => {
          if (menuBook) setBookStatus(menuBook, status, { fromSheet: true });
        }}
        onDelete={() => {
          const book = menuBook;
          if (book) setTimeout(() => confirmDelete(book), SHEET_HANDOFF_MS);
        }}
        // menuBook stays set so the sheet keeps its content while it slides away
        onClose={() => setMenuOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    paddingHorizontal: SPACING[1],
  },
  content: {
    paddingHorizontal: SPACING[5],
    paddingBottom: SPACING[8],
  },
  controls: {
    gap: SPACING[3],
    paddingTop: SPACING[2],
    paddingBottom: SPACING[2],
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
    minHeight: 44,
    paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line.strong,
    backgroundColor: COLORS.paper.raised,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 16,
    color: COLORS.ink.primary,
    paddingVertical: SPACING[2],
  },
  filters: {
    gap: SPACING[2],
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summary: TYPE.meta,
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
  },
  sortText: {
    ...TYPE.meta,
    color: COLORS.ink.primary,
  },
  pressed: {
    opacity: 0.6,
  },
  error: {
    ...TYPE.meta,
    color: COLORS.destructive.ink,
  },
  sectionHeader: {
    marginTop: SPACING[5],
    marginBottom: SPACING[1],
  },
  noMatch: {
    ...TYPE.meta,
    paddingVertical: SPACING[6],
    textAlign: "center",
  },
  emptyLibrary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING[3],
    paddingHorizontal: SPACING[6],
  },
  emptyTitle: {
    ...TYPE.title,
    textAlign: "center",
  },
  emptyText: {
    ...TYPE.byline,
    textAlign: "center",
    marginBottom: SPACING[2],
  },
});
