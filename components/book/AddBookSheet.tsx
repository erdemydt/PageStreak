import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { addBook, findBookByOpenLibraryKey } from "../../db/repos/books";
import {
  OpenLibraryService,
  SearchBookResult,
} from "../../services/openLibrary";
import { COLORS } from "../../themes/colors";
import { RADIUS, SPACING } from "../../themes/spacing";
import { FONTS, TYPE } from "../../themes/typography";
import { showToast } from "../../utils/toast";
import { BookStatus } from "../BookStatusModal";
import BookCover from "../ui/BookCover";
import Button from "../ui/Button";
import Chip from "../ui/Chip";
import Hairline from "../ui/Hairline";
import Sheet from "../ui/Sheet";

type Mode = "search" | "pick" | "manual";

const STATUSES: BookStatus[] = ["currently_reading", "want_to_read", "read"];

/**
 * Add a book: search Open Library, or enter it by hand. Stays open after an
 * add so several books can go in a row, unless `closeOnAdd`.
 */
export default function AddBookSheet({
  visible,
  onClose,
  initialStatus = "want_to_read",
  closeOnAdd = false,
}: {
  visible: boolean;
  onClose: () => void;
  initialStatus?: BookStatus;
  closeOnAdd?: boolean;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchBookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<SearchBookResult | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [status, setStatus] = useState<BookStatus>(initialStatus);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("");
  const [saving, setSaving] = useState(false);
  // Ignore responses to searches that were superseded
  const searchId = useRef(0);
  const pickId = useRef(0);
  const authorRef = useRef<TextInput>(null);
  const pagesRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    // Drop anything still in flight from the last time it was open
    searchId.current++;
    pickId.current++;
    setSearching(false);
    setPicked(null);
    setDuplicate(false);
    setMode("search");
    setQuery("");
    setResults([]);
    setSearched(false);
    setSearchError(false);
    setStatus(initialStatus);
    // Reset only when it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    const id = ++searchId.current;
    setSearching(true);
    setSearchError(false);
    try {
      const found = await OpenLibraryService.searchBooks(q);
      if (id !== searchId.current) return;
      setResults(found);
    } catch (error) {
      if (id !== searchId.current) return;
      console.error("Search error:", error);
      setResults([]);
      setSearchError(true);
    } finally {
      if (id === searchId.current) {
        setSearching(false);
        setSearched(true);
      }
    }
  };

  const pick = async (book: SearchBookResult) => {
    const id = ++pickId.current;
    setPicked(book);
    setDuplicate(false);
    setMode("pick");
    try {
      const existing = await findBookByOpenLibraryKey(book.key);
      if (id === pickId.current) setDuplicate(!!existing);
    } catch (error) {
      // The duplicate check is a courtesy; never block adding over it
      console.error("Duplicate check failed:", error);
    }
  };

  const openManual = () => {
    // Carry the search over as the title: it's usually what they typed
    setTitle(query.trim());
    setAuthor("");
    setPages("");
    setMode("manual");
  };

  const pageCount = Number(pages.trim() || "0");
  const manualValid =
    title.trim().length > 0 && Number.isInteger(pageCount) && pageCount >= 0;

  const save = async () => {
    if (mode === "manual" && !manualValid) return;
    if (mode === "pick" && !picked) return;
    setSaving(true);
    try {
      let name: string;
      if (mode === "pick" && picked) {
        name = picked.title;
        await addBook(
          {
            name: picked.title,
            author: picked.authors.join(", "),
            page: picked.pageCount || 0,
            isbn: picked.isbn,
            cover_id: picked.coverId,
            cover_url: picked.coverUrl,
            first_publish_year: picked.firstPublishYear,
            publisher: picked.publisher,
            language: picked.language,
            subjects: picked.subjects ? JSON.stringify(picked.subjects) : null,
            open_library_key: picked.key,
            rating: picked.rating,
          },
          status,
        );
      } else {
        name = title.trim();
        await addBook(
          { name, author: author.trim(), page: pageCount },
          status,
        );
      }
      showToast({ message: t("addBook.added", { title: name }) });
      if (closeOnAdd) {
        onClose();
      } else {
        setMode("search");
      }
    } catch (error) {
      console.error("Error adding book:", error);
      Alert.alert(t("error"), t("booksPage.search.failedToAddBook"));
    } finally {
      setSaving(false);
    }
  };

  const statusLabels: Record<BookStatus, string> = {
    currently_reading: t("library.reading"),
    want_to_read: t("library.wantToRead"),
    read: t("library.read"),
  };

  const statusPicker = (
    <View style={styles.statusBlock}>
      <Text style={styles.fieldLabel}>{t("addBook.addAs")}</Text>
      <View style={styles.chips}>
        {STATUSES.map((s) => (
          <Chip
            key={s}
            label={statusLabels[s]}
            selected={status === s}
            onPress={() => setStatus(s)}
            disabled={saving}
            grow
          />
        ))}
      </View>
    </View>
  );

  const footer =
    mode === "search" ? undefined : (
      <>
        <Button
          title={t("addBook.back")}
          variant="secondary"
          onPress={() => setMode("search")}
          disabled={saving}
        />
        <Button
          title={t("addBook.add")}
          onPress={save}
          loading={saving}
          disabled={mode === "manual" && !manualValid}
          grow
        />
      </>
    );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={!saving}
      title={mode === "manual" ? t("addBook.manualTitle") : t("addBook.title")}
      footer={footer}
    >
      {mode === "search" && (
        <View>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={COLORS.ink.secondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              placeholder={t("addBook.searchPlaceholder")}
              placeholderTextColor={COLORS.ink.disabled}
              returnKeyType="search"
              autoCorrect={false}
              autoFocus
              accessibilityLabel={t("addBook.searchPlaceholder")}
            />
            {searching && <ActivityIndicator color={COLORS.ink.secondary} />}
          </View>

          {searchError ? (
            <Text style={styles.message}>{t("addBook.failed")}</Text>
          ) : searched && !searching && results.length === 0 ? (
            <Text style={styles.message}>{t("addBook.noResults")}</Text>
          ) : !searched ? (
            <Text style={styles.message}>{t("addBook.hint")}</Text>
          ) : null}

          {results.map((book, index) => (
            <View key={book.key}>
              {index > 0 && <Hairline />}
              <Pressable
                onPress={() => pick(book)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.result,
                  pressed && styles.pressed,
                ]}
              >
                <BookCover
                  uri={book.coverUrl}
                  title={book.title}
                  author={book.authors[0]}
                  width={40}
                />
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {book.title}
                  </Text>
                  {book.authors.length > 0 && (
                    <Text style={styles.resultAuthor} numberOfLines={1}>
                      {book.authors.join(", ")}
                    </Text>
                  )}
                  <Text style={styles.resultMeta}>
                    {[
                      book.firstPublishYear,
                      book.pageCount
                        ? pagesText(t, book.pageCount)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Ionicons
                  name="add-circle-outline"
                  size={24}
                  color={COLORS.accent.primary}
                />
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={openManual}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.manualLink, pressed && styles.pressed]}
          >
            <Text style={styles.manualLinkText}>{t("addBook.manualLink")}</Text>
          </Pressable>
        </View>
      )}

      {mode === "pick" && picked && (
        <View style={styles.pick}>
          <View style={styles.pickHero}>
            <BookCover
              uri={picked.coverUrl}
              title={picked.title}
              author={picked.authors[0]}
              width={72}
            />
            <View style={styles.resultText}>
              <Text style={styles.pickTitle}>{picked.title}</Text>
              {picked.authors.length > 0 && (
                <Text style={styles.resultAuthor}>
                  {picked.authors.join(", ")}
                </Text>
              )}
              <Text style={styles.resultMeta}>
                {picked.pageCount
                  ? pagesText(t, picked.pageCount)
                  : t("addBook.pagesLater")}
              </Text>
            </View>
          </View>
          {duplicate && (
            <Text style={styles.warning}>{t("addBook.alreadyInLibrary")}</Text>
          )}
          {statusPicker}
        </View>
      )}

      {mode === "manual" && (
        <View style={styles.form}>
          <Field label={t("addBook.titleField")}>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              autoCapitalize="words"
              autoFocus={!title}
              returnKeyType="next"
              onSubmitEditing={() => authorRef.current?.focus()}
              blurOnSubmit={false}
              editable={!saving}
              accessibilityLabel={t("addBook.titleField")}
            />
          </Field>
          <Field label={t("addBook.authorField")}>
            <TextInput
              style={styles.input}
              ref={authorRef}
              value={author}
              onChangeText={setAuthor}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => pagesRef.current?.focus()}
              blurOnSubmit={false}
              editable={!saving}
              accessibilityLabel={t("addBook.authorField")}
            />
          </Field>
          <Field label={t("addBook.pagesField")} hint={t("addBook.optional")}>
            <TextInput
              style={styles.input}
              ref={pagesRef}
              value={pages}
              onChangeText={setPages}
              keyboardType="number-pad"
              maxLength={5}
              editable={!saving}
              accessibilityLabel={t("addBook.pagesField")}
            />
          </Field>
          {statusPicker}
        </View>
      )}
    </Sheet>
  );
}

function pagesText(t: TFunction, count: number) {
  return count === 1 ? t("bookPage.pagesValueOne") : t("library.pages", { count });
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {hint ? <Text style={styles.fieldHint}>{`  ${hint}`}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
    minHeight: 48,
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
  message: {
    ...TYPE.meta,
    paddingVertical: SPACING[4],
  },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
    paddingVertical: SPACING[3],
  },
  pressed: {
    opacity: 0.6,
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    fontFamily: FONTS.serif,
    fontSize: 17,
    lineHeight: 22,
    color: COLORS.ink.primary,
  },
  resultAuthor: {
    ...TYPE.meta,
    fontFamily: FONTS.serifItalic,
  },
  resultMeta: TYPE.meta,
  manualLink: {
    paddingVertical: SPACING[4],
    alignSelf: "flex-start",
  },
  manualLinkText: {
    ...TYPE.label,
    color: COLORS.accent.primary,
  },
  pick: {
    gap: SPACING[4],
  },
  pickHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[4],
  },
  pickTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 28,
    color: COLORS.ink.primary,
  },
  warning: {
    ...TYPE.meta,
    color: COLORS.streak.ink,
  },
  statusBlock: {
    gap: SPACING[2],
  },
  chips: {
    flexDirection: "row",
    gap: SPACING[2],
  },
  form: {
    gap: SPACING[4],
  },
  field: {
    gap: SPACING[2],
  },
  fieldLabel: TYPE.label,
  fieldHint: {
    ...TYPE.meta,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line.strong,
    backgroundColor: COLORS.paper.raised,
    fontFamily: FONTS.sans,
    fontSize: 16,
    color: COLORS.ink.primary,
  },
});
