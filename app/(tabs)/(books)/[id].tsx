import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
<<<<<<< HEAD
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
=======
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
>>>>>>> origin/xccBuild
} from "react-native";
import BookMenuSheet from "../../../components/book/BookMenuSheet";
import BookStatusModal, {
<<<<<<< HEAD
  BookStatus,
} from "../../../components/BookStatusModal";
import SessionRow from "../../../components/session/SessionRow";
import BookCover from "../../../components/ui/BookCover";
import Button from "../../../components/ui/Button";
import Hairline from "../../../components/ui/Hairline";
import ProgressRule from "../../../components/ui/ProgressRule";
import StatRow, { Stat } from "../../../components/ui/StatRow";
import { useSessionSheets } from "../../../contexts/SessionSheetsContext";
import { EnhancedBook } from "../../../db/db";
import { getBook } from "../../../db/repos/books";
import { getDailyGoal } from "../../../db/repos/preferences";
import {
  getAverageMinutesPerDay,
  getPagesPerMinute,
  listSessionsForBook,
  SessionWithBook,
} from "../../../db/repos/sessions";
import { useBookStatusChange } from "../../../hooks/useBookStatusChange";
import { useFocusRefresh } from "../../../hooks/useFocusRefresh";
=======
    BookStatus,
} from "../../../components/books/BookStatusModal";
import { EnhancedBook, execute, queryFirst } from "../../../db/db";
>>>>>>> origin/xccBuild
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { FONTS, TYPE } from "../../../themes/typography";
import {
<<<<<<< HEAD
  addDaysToDateString,
  getTodayDateString,
} from "../../../utils/dateUtils";
import {
  formatDate,
  formatShortDate,
  formatDuration,
  formatLanguage,
  formatSessionDay,
  formatSessionDetail,
  toAppUpperCase,
} from "../../../utils/format";
import {
  estimateDaysToFinish,
  getEnhancedBookProgress,
=======
    getBookReadingTime,
    getEnhancedBookProgress,
>>>>>>> origin/xccBuild
} from "../../../utils/readingProgress";

const SESSIONS_PREVIEW = 5;

type FinishEstimate = { date: string; basedOnGoal: boolean };
const MIN_SESSIONS_FOR_ESTIMATE = 3;

/**
 * A book's home: its status, progress, sessions and details. Opened from the
 * Library and (via a re-export) from Today, inside the tab it was opened from.
 */
export default function BookDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { openLogger, editSession } = useSessionSheets();
  const setBookStatus = useBookStatusChange();

  const [book, setBook] = useState<EnhancedBook | null>(null);
  const [sessions, setSessions] = useState<SessionWithBook[]>([]);
  const [pagesRead, setPagesRead] = useState(0);
  const [finishEstimate, setFinishEstimate] = useState<FinishEstimate | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuMode, setMenuMode] = useState<"menu" | "pages">("menu");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  // Set before a delete starts: its change event must not reload a book
  // that's gone (that would flash "not found" before going back)
  const deleting = useRef(false);

  const loadData = useCallback(async () => {
    if (!id || deleting.current) return;
    setError(null);

    try {
      const numericId = Number(id);
      const foundBook = await getBook(numericId);
      if (!foundBook) {
        setError(t("components.bookDetailModal.bookNotFound"));
        setBook(null);
        return;
      }

      const [bookSessions, progress] = await Promise.all([
        listSessionsForBook(numericId),
        getEnhancedBookProgress(
          foundBook.id,
          foundBook.page,
          foundBook.current_page || 0,
        ),
      ]);
      setBook(foundBook);
      setSessions(bookSessions);
      // Finished books are pinned to their length; session sums can overshoot
      setPagesRead(
        foundBook.page <= 0
          ? progress.pagesRead
          : foundBook.reading_status === "read"
            ? foundBook.page
            : Math.min(progress.pagesRead, foundBook.page),
      );

      // "Finish by": pace (pages/min) x minutes per day, using this book's
      // recent reading, else all recent reading, else the daily goal. One or
      // two sessions are too few to judge a pace from.
      const pagedSessions = bookSessions.filter(
        (session) => (session.pages_read ?? 0) > 0,
      ).length;
      if (
        foundBook.reading_status === "currently_reading" &&
        foundBook.page > 0 &&
        pagedSessions >= MIN_SESSIONS_FOR_ESTIMATE
      ) {
        const [pagesPerMinute, bookMinutes, allMinutes] = await Promise.all([
          getPagesPerMinute(foundBook.id),
          getAverageMinutesPerDay(14, foundBook.id),
          getAverageMinutesPerDay(14),
        ]);
        const recentMinutes = bookMinutes > 0 ? bookMinutes : allMinutes;
        const days = estimateDaysToFinish({
          remainingPages: foundBook.page - progress.pagesRead,
          pagesPerMinute,
          minutesPerDay:
            recentMinutes > 0 ? recentMinutes : await getDailyGoal(),
        });
        setFinishEstimate(
          days === null
            ? null
            : {
                date: addDaysToDateString(getTodayDateString(), days),
                basedOnGoal: recentMinutes <= 0,
              },
        );
      } else {
        setFinishEstimate(null);
      }
    } catch (e) {
      console.error("Failed to load book details:", e);
      setError(t("booksPage.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useFocusRefresh(loadData, ["books", "sessions"], [loadData]);

  const changeStatus = (status: BookStatus, fromSheet = false) => {
    if (book) setBookStatus(book, status, { fromSheet });
  };

  const openMenu = (mode: "menu" | "pages") => {
    setMenuMode(mode);
    setShowMenu(true);
  };

  const header = (
    <Stack.Screen
      options={{
        title: "",
        headerRight: book
          ? () => (
              <Pressable
                onPress={() => openMenu("menu")}
                accessibilityRole="button"
                accessibilityLabel={t("bookPage.more")}
                hitSlop={10}
                style={styles.headerButton}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={22}
                  color={COLORS.ink.primary}
                />
              </Pressable>
            )
          : undefined,
      }}
    />
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        {header}
        <ActivityIndicator color={COLORS.accent.primary} />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.centerState}>
        {header}
        <Text style={styles.centerText}>
          {error || t("components.bookDetailModal.bookNotFound")}
        </Text>
      </View>
    );
  }

  const status = book.reading_status as BookStatus;
  const percent =
    book.page > 0 ? Math.min(100, Math.round((pagesRead / book.page) * 100)) : 0;

  const statusLine =
    status === "currently_reading"
      ? book.date_started
        ? t("bookPage.statusReadingSince", {
            date: formatShortDate(book.date_started, "long"),
          })
        : t("bookPage.statusReading")
      : status === "read"
        ? book.date_finished
          ? t("bookPage.statusFinishedOn", {
              date: formatShortDate(book.date_finished, "long"),
            })
          : t("bookPage.statusFinished")
        : t("bookPage.statusWantToRead");

  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes_read, 0);
  const lastStat: Stat =
    status === "currently_reading" && finishEstimate
      ? {
          label: t("bookPage.finishBy"),
          value: formatShortDate(finishEstimate.date),
          emphasis: true,
        }
      : status === "read" && book.date_finished
        ? {
            label: t("bookPage.finished"),
            value: formatShortDate(book.date_finished),
          }
        : {
            label: t("bookPage.added"),
            value: formatShortDate(book.date_added) || "—",
          };
  const stats: Stat[] = [
    {
      label: t("bookPage.pages"),
      value:
        book.page > 0 ? (
          status === "want_to_read" ? (
            String(book.page)
          ) : (
            <>
              {pagesRead}
              <Text style={styles.statSmall}>/{book.page}</Text>
            </>
          )
        ) : (
          "—"
        ),
    },
    { label: t("bookPage.timeRead"), value: formatDuration(totalMinutes) },
    lastStat,
  ];

  const visibleSessions = showAllSessions
    ? sessions
    : sessions.slice(0, SESSIONS_PREVIEW);

  const aboutRows: { label: string; value: string }[] = [
    {
      label: t("components.bookDetailModal.publishedDate"),
      value: book.first_publish_year ? String(book.first_publish_year) : "",
    },
    { label: t("components.bookDetailModal.publisher"), value: book.publisher || "" },
    {
      label: t("components.bookDetailModal.language"),
      value: formatLanguage(book.language),
    },
    { label: "ISBN", value: book.isbn || "" },
    {
      label: t("components.bookDetailModal.addedToLibrary"),
      value: formatDate(book.date_added),
    },
    {
      label: t("components.bookDetailModal.dateStarted"),
      value: formatDate(book.date_started),
    },
    {
      label: t("components.bookDetailModal.dateFinished"),
      value: formatDate(book.date_finished),
    },
  ].filter((row) => row.value);

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <BookCover
            uri={book.cover_url}
            title={book.name}
            author={book.author}
            width={112}
          />
          <Pressable
            onPress={() => setShowStatus(true)}
            accessibilityRole="button"
            accessibilityLabel={`${statusLine}. ${t("bookPage.changeStatus")}`}
            hitSlop={8}
            style={({ pressed }) => [styles.status, pressed && styles.pressed]}
          >
            <Text style={styles.statusText}>{toAppUpperCase(statusLine)}</Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={COLORS.accent.primary}
            />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {book.name}
          </Text>
          <Text style={styles.author}>{book.author}</Text>
        </View>

        <StatRow stats={stats} style={styles.stats} />

        {book.page <= 0 && status !== "want_to_read" && (
          <Pressable
            onPress={() => openMenu("pages")}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.progress, pressed && styles.pressed]}
          >
            <Text style={styles.setPages}>{t("bookPage.setPageCount")}</Text>
          </Pressable>
        )}

        {status === "currently_reading" && book.page > 0 && (
          <View style={styles.progress}>
            <ProgressRule
              progress={percent / 100}
              color={COLORS.ink.primary}
              thickness={2}
            />
            {finishEstimate && (
              <Text style={styles.meta}>
                {finishEstimate.basedOnGoal
                  ? t("bookPage.paceGoal")
                  : t("bookPage.paceRecent")}
              </Text>
            )}
          </View>
        )}

        <View style={styles.actions}>
          {status === "currently_reading" && (
            <>
              <Button
                title={t("bookPage.logReading")}
                onPress={() => openLogger({ bookId: book.id })}
                grow
              />
              <Button
                title={t("bookPage.markFinished")}
                variant="secondary"
                onPress={() => changeStatus("read")}
              />
            </>
          )}
          {status === "want_to_read" && (
            <Button
              title={t("bookPage.startReading")}
              onPress={() => changeStatus("currently_reading")}
              grow
            />
          )}
          {status === "read" && (
            <Button
              title={t("bookPage.readAgain")}
              variant="secondary"
              onPress={() => changeStatus("currently_reading")}
              grow
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t("bookPage.sessions")}
            </Text>
            {sessions.length > 0 && (
              <Text style={styles.meta}>
                {t("bookPage.sessionCount", { count: sessions.length })}
              </Text>
            )}
          </View>
          {sessions.length === 0 ? (
            <Text style={styles.empty}>{t("bookPage.noSessions")}</Text>
          ) : (
            <View style={styles.sessionList}>
              {visibleSessions.map((session) => (
                <Fragment key={session.id}>
                  <SessionRow
                    label={formatSessionDay(session.date)}
                    detail={formatSessionDetail(session)}
                    onPress={() => editSession(session)}
                  />
                  <Hairline />
                </Fragment>
              ))}
              {sessions.length > SESSIONS_PREVIEW && (
                <Button
                  title={
                    showAllSessions
                      ? t("bookPage.showFewer")
                      : t("bookPage.showAll", { count: sessions.length })
                  }
                  variant="ghost"
                  compact
                  onPress={() => setShowAllSessions((shown) => !shown)}
                  style={styles.showAll}
                />
              )}
            </View>
          )}
        </View>

        {(aboutRows.length > 0 || book.description || book.notes) && (
          <View style={styles.section}>
            <Pressable
              onPress={() => setAboutOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: aboutOpen }}
              style={({ pressed }) => [
                styles.sectionHeader,
                styles.aboutHeader,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.sectionTitle}>{t("bookPage.about")}</Text>
              <Ionicons
                name={aboutOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={COLORS.ink.secondary}
              />
            </Pressable>
            {aboutOpen && (
              <View style={styles.about}>
                {aboutRows.map((row) => (
                  <View key={row.label} style={styles.aboutRow}>
                    <Text style={styles.aboutLabel}>{row.label}</Text>
                    <Text style={styles.aboutValue}>{row.value}</Text>
                  </View>
                ))}
                {book.description ? (
                  <Text style={styles.paragraph}>{book.description}</Text>
                ) : null}
                {book.notes ? (
                  <View style={styles.notes}>
                    <Text style={styles.aboutLabel}>{t("bookPage.notes")}</Text>
                    <Text style={styles.paragraph}>{book.notes}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <BookStatusModal
        visible={showStatus}
        bookTitle={book.name}
        currentStatus={status || "want_to_read"}
        onStatusChange={(next) => changeStatus(next, true)}
        onClose={() => setShowStatus(false)}
      />
      <BookMenuSheet
        book={book}
        visible={showMenu}
        initialMode={menuMode}
        onClose={() => setShowMenu(false)}
        onDeleting={(active) => {
          deleting.current = active;
        }}
        onDeleted={() => router.back()}
        sessionCount={sessions.length}
        minutesRead={totalMinutes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.paper.base,
  },
  content: {
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[2],
    paddingBottom: SPACING[8],
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING[5],
    backgroundColor: COLORS.paper.base,
  },
  centerText: TYPE.byline,
  headerButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  hero: {
    alignItems: "center",
    gap: SPACING[2],
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: SPACING[4],
    minHeight: 32,
  },
  statusText: {
    ...TYPE.eyebrow,
    color: COLORS.accent.primary,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    lineHeight: 38,
    textAlign: "center",
    color: COLORS.ink.primary,
  },
  author: {
    ...TYPE.byline,
    fontSize: 18,
    textAlign: "center",
  },
  stats: {
    marginTop: SPACING[5],
  },
  statSmall: {
    fontSize: 15,
    color: COLORS.ink.secondary,
  },
  progress: {
    marginTop: SPACING[4],
    gap: SPACING[2],
  },
  meta: TYPE.meta,
  setPages: {
    ...TYPE.meta,
    color: COLORS.accent.primary,
    textDecorationLine: "underline",
  },
  actions: {
    flexDirection: "row",
    gap: SPACING[3],
    marginTop: SPACING[5],
  },
  section: {
    marginTop: SPACING[6],
    gap: SPACING[2],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionTitle: TYPE.headline,
  empty: {
    ...TYPE.body,
    paddingVertical: SPACING[2],
  },
  sessionList: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
  },
  showAll: {
    alignSelf: "flex-start",
    marginTop: SPACING[2],
    paddingHorizontal: 0,
  },
  aboutHeader: {
    alignItems: "center",
    minHeight: 44,
  },
  about: {
    gap: SPACING[3],
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING[4],
  },
  aboutLabel: TYPE.meta,
  aboutValue: {
    ...TYPE.body,
    color: COLORS.ink.primary,
    flexShrink: 1,
    textAlign: "right",
  },
  paragraph: {
    ...TYPE.body,
    lineHeight: 23,
  },
  notes: {
    gap: SPACING[1],
  },
});
