import { Link, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";

import BookCard from "../../../components/BookCard";
import DailyProgressCard from "../../../components/DailyProgressCard";
import ReadingTimeLogger from "../../../components/ReadingTimeLogger";
import { getUserPreferences } from "../../../db/repos/preferences";
import type { UserPreferences } from "../../../types/models";
import { BookWithStats, listBooksWithStats } from "../../../db/repos/books";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { TYPE } from "../../../themes/typography";
import { parseDbDate } from "../../../utils/dateUtils";
import {
  getReadingStreak,
  getTodayReadingMinutes,
} from "../../../utils/readingProgress";
import { useFocusRefresh } from "../../../hooks/useFocusRefresh";

export default function HomeScreen() {
  const { t } = useTranslation();
  const [books, setBooks] = useState<BookWithStats[]>([]);
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [showReadingLogger, setShowReadingLogger] = useState(false);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [readingStreak, setReadingStreak] = useState(0);

  const loadData = async () => {
    try {
      // Load user preferences
      const user = await getUserPreferences();
      setUserPreferences(user);

      // Load today's reading progress
      await loadTodayProgress();

      // Load reading streak
      await loadReadingStreak();

      setBooks(await listBooksWithStats({ order: "recent" }));
    } catch (e) {
      console.error("Failed to load data:", e);
    }
  };
  // Reload on focus, and when books/sessions/preferences change underneath
  // (e.g. the reading logger modal saving a session)
  useFocusRefresh(loadData, ["books", "sessions", "preferences"]);

  const loadTodayProgress = async () => {
    try {
      const minutes = await getTodayReadingMinutes();
      setTodayMinutes(minutes);
    } catch (e) {
      console.error("Error loading today progress:", e);
      setTodayMinutes(0);
    }
  };

  const loadReadingStreak = async () => {
    try {
      setReadingStreak(await getReadingStreak());
    } catch (e) {
      console.error("Error calculating reading streak:", e);
      setReadingStreak(0);
    }
  };

  // Yearly goal progress: only count books finished this calendar year
  const currentYear = new Date().getFullYear();
  const booksRead = books.filter(
    (book) =>
      book.reading_status === "read" &&
      parseDbDate(book.date_finished)?.getFullYear() === currentYear,
  ).length;
  const currentlyReading = books.filter(
    (book) => book.reading_status === "currently_reading",
  ).length;
  const wantToRead = books.filter(
    (book) => book.reading_status === "want_to_read",
  ).length;
  const yearlyGoal = userPreferences?.yearly_book_goal || 0;
  const progressPercentage =
    yearlyGoal > 0 ? Math.min((booksRead / yearlyGoal) * 100, 100) : 0;
  // Only a book actually in progress belongs under the "Reading" label
  const currentBook =
    books.find((book) => book.reading_status === "currently_reading") ?? null;

  const openBook = (bookId: number) =>
    router.push({
      pathname: "/(tabs)/(home)/book/[id]",
      params: { id: bookId.toString() },
    });

  const renderBook = ({ item }: { item: BookWithStats }) => (
    <BookCard book={item} compact={true} onPress={() => openBook(item.id)} />
  );

  // Rendered as an element (not a component type defined during render), so the
  // header isn't unmounted and remounted on every state change
  const listHeader = (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{t("home.title")}</Text>
        {userPreferences && (
          <Text style={styles.subtitle}>
            {t("home.welcomeBack", { username: userPreferences.username })}
          </Text>
        )}
      </View>

      {/* Continue Reading Hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroEyebrow}>{t("home.reading")}</Text>
          <Text style={styles.heroStreakText}>
            {t("home.streakShort", { count: readingStreak })}
          </Text>
        </View>

        {currentBook ? (
          <>
            <TouchableOpacity
              style={styles.heroBookRow}
              onPress={() => openBook(currentBook.id)}
              accessibilityRole="button"
            >
              {currentBook.cover_url ? (
                <Image
                  source={{ uri: currentBook.cover_url }}
                  style={styles.heroCover}
                  placeholder={require("../../../assets/images/icon.png")}
                  cachePolicy="memory-disk"
                  transition={150}
                />
              ) : (
                <View style={styles.heroCoverPlaceholder}>
                  <Text style={styles.heroCoverPlaceholderText}>📖</Text>
                </View>
              )}

              <View style={styles.heroBookMeta}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {currentBook.name}
                </Text>
                <Text style={styles.heroAuthor} numberOfLines={1}>
                  {currentBook.author}
                </Text>
                <Text style={styles.heroPages}>
                  {currentBook.page} {t("components.bookCard.pages")}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroPrimaryButton}
              onPress={() => setShowReadingLogger(true)}
            >
              <Text style={styles.heroPrimaryButtonText}>
                {t("home.logReadingTime")}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.heroEmptyState}>
            <Text style={styles.heroEmptyTitle}>
              {books.length > 0
                ? t("home.noBookInProgress")
                : t("home.noBooksYet")}
            </Text>
            <Link
              href={
                books.length > 0
                  ? "/(tabs)/(books)/my-books"
                  : "/(tabs)/(books)"
              }
              withAnchor
              asChild
            >
              <TouchableOpacity style={styles.heroPrimaryButton}>
                <Text style={styles.heroPrimaryButtonText}>
                  {books.length > 0
                    ? t("home.chooseBookToRead")
                    : t("home.discoverBooks")}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        )}
      </View>

      {/* Daily Reading Progress Card */}
      <DailyProgressCard
        todayMinutes={todayMinutes}
        goalMinutes={
          userPreferences?.current_reading_rate_minutes_per_day || 30
        }
        streakDays={readingStreak}
      />

      <View style={styles.actionsRow}>
        <Link href={"/readinglogs"} asChild>
          <TouchableOpacity style={styles.secondaryActionButton}>
            <Text style={styles.secondaryActionButtonText}>
              {t("home.viewReadingLogs")}
            </Text>
          </TouchableOpacity>
        </Link>
        <Link href="/(tabs)/(books)" asChild>
          <TouchableOpacity style={styles.secondaryActionButton}>
            <Text style={styles.secondaryActionButtonText}>
              {t("home.seeAll")}
            </Text>
          </TouchableOpacity>
        </Link>
      </View>

      <View style={styles.progressSummaryCard}>
        <Text style={styles.cardTitle}>{t("home.readingJourney")}</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{booksRead}</Text>
              <Text style={styles.statLabel}>{t("home.booksRead")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{currentlyReading}</Text>
              <Text style={styles.statLabel}>{t("home.reading")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{wantToRead}</Text>
              <Text style={styles.statLabel}>{t("home.wantToRead")}</Text>
            </View>
          </View>

          {yearlyGoal > 0 && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {booksRead >= yearlyGoal
                  ? t("home.goalAchieved")
                  : t("home.goalProgress", {
                      remaining: yearlyGoal - booksRead,
                      goal: yearlyGoal,
                    })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Recent Books Section */}
      <View style={styles.listSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t("home.recentBooks", { count: books.length })}
          </Text>
          <Link href="/(tabs)/(books)" asChild>
            <TouchableOpacity style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>{t("home.seeAll")}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={books.slice(0, 4)} // Show only recent 4 books
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderBook}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>{t("home.noBooksYet")}</Text>
            <Text style={styles.emptySubtitle}>
              {t("home.startDiscovering")}
            </Text>
            <Link href="/(tabs)/(books)" asChild>
              <TouchableOpacity style={styles.addFirstBookBtn}>
                <Text style={styles.addFirstBookText}>
                  {t("home.discoverBooks")}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        }
        style={styles.list}
        showsVerticalScrollIndicator={false}
      />
      {/* Reading Time Logger Modal */}
      <ReadingTimeLogger
        visible={showReadingLogger}
        onClose={() => setShowReadingLogger(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface.page,
  },
  header: {
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[5],
    paddingBottom: SPACING[3],
    alignItems: "flex-start",
  },
  title: {
    ...TYPE.pageTitle,
  },
  subtitle: {
    ...TYPE.body,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: COLORS.surface.raised,
    marginHorizontal: SPACING[4],
    marginBottom: SPACING[3],
    padding: SPACING[4],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING[3],
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: COLORS.text.secondary,
  },
  heroStreakText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.accent.strong,
  },
  heroBookRow: {
    flexDirection: "row",
    gap: SPACING[3],
    marginBottom: SPACING[3],
  },
  heroCover: {
    width: 62,
    height: 92,
    borderRadius: 8,
    backgroundColor: COLORS.neutral[100],
  },
  heroCoverPlaceholder: {
    width: 62,
    height: 92,
    borderRadius: 8,
    backgroundColor: COLORS.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  heroCoverPlaceholderText: {
    fontSize: 24,
  },
  heroBookMeta: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  heroAuthor: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  heroPages: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  heroPrimaryButton: {
    backgroundColor: COLORS.accent.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  heroPrimaryButtonText: {
    color: COLORS.text.inverse,
    fontSize: 15,
    fontWeight: "600",
  },
  heroEmptyState: {
    gap: SPACING[3],
  },
  heroEmptyTitle: {
    ...TYPE.body,
    color: COLORS.text.secondary,
  },
  progressSummaryCard: {
    backgroundColor: COLORS.surface.raised,
    marginHorizontal: SPACING[4],
    marginTop: SPACING[2],
    padding: SPACING[4],
    borderRadius: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: {
    ...TYPE.cardTitle,
    marginBottom: SPACING[3],
  },
  progressContainer: {
    gap: SPACING[3],
  },
  progressStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.neutral[200],
  },
  progressBarContainer: {
    gap: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: COLORS.neutral[200],
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "left",
    fontWeight: "500",
  },
  listSection: {
    flex: 1,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.neutral[800],
  },
  seeAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.neutral[100],
    borderRadius: 8,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.accent.strong,
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
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
    marginBottom: 20,
  },
  addFirstBookBtn: {
    backgroundColor: COLORS.accent.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFirstBookText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
  },
  actionsRow: {
    paddingHorizontal: SPACING[4],
    marginBottom: SPACING[3],
    flexDirection: "row",
    gap: SPACING[2],
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: COLORS.surface.interactive,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryActionButtonText: {
    color: COLORS.accent.strong,
    fontSize: 14,
    fontWeight: "600",
  },
});
