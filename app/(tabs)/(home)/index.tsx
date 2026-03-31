import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import BookCard from "../../../components/BookCard";
import DailyProgressCard from "../../../components/DailyProgressCard";
import ReadingTimeLogger from "../../../components/ReadingTimeLogger";
import { EnhancedBook, queryAll, queryFirst } from "../../../db/db";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { TYPE } from "../../../themes/typography";
import type { UserPreferences } from "../../../types/database";
import {
    getTodayReadingMinutes,
    initializeReadingSessions,
} from "../../../utils/readingProgress";

const GOAL_INCREASE_BANNER_EVENT_KEY = "@pagestreak/goal-increase-banner-event";

type GoalIncreaseBannerEvent = {
  oldGoal: number;
  newGoal: number;
  timestamp: string;
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const [books, setBooks] = useState<EnhancedBook[]>([]);
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [goalIncreaseBanner, setGoalIncreaseBanner] =
    useState<GoalIncreaseBannerEvent | null>(null);
  const [showReadingLogger, setShowReadingLogger] = useState(false);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load data on mount and when screen comes into focus
  useEffect(() => {
    initializeApp();
  }, []);

  // Refresh data when screen comes into focus (e.g., when returning from books tab)
  useFocusEffect(
    useCallback(() => {
      loadData();
      loadGoalIncreaseBanner();
    }, []),
  );

  const initializeApp = async () => {
    await initializeReadingSessions();
    loadData();
  };

  const loadData = async () => {
    try {
      // Load user preferences
      const user = await queryFirst<UserPreferences>(
        "SELECT * FROM user_preferences WHERE id = 1",
      );
      setUserPreferences(user);

      // Load today's reading progress
      await loadTodayProgress();

      // Load books - try enhanced books first, fallback to regular books
      try {
        const enhancedBooks = await queryAll<EnhancedBook>(
          "SELECT * FROM enhanced_books ORDER BY date_added DESC",
        );
        setBooks(enhancedBooks);
      } catch (e) {
        // Fallback to regular books table
        try {
          const regularBooks = await queryAll<{
            id: number;
            name: string;
            author: string;
            page: number;
          }>("SELECT * FROM books ORDER BY id DESC");
          const mappedBooks: EnhancedBook[] = regularBooks.map((book) => ({
            ...book,
            reading_status: "read" as const,
            date_added: new Date().toISOString(),
            current_page: book.page,
          }));
          setBooks(mappedBooks);
        } catch (bookError) {
          console.log("No books table found");
          setBooks([]);
        }
      }
    } catch (e) {
      console.error("Failed to load data:", e);
    }
  };

  const loadGoalIncreaseBanner = async () => {
    try {
      const storedEvent = await AsyncStorage.getItem(
        GOAL_INCREASE_BANNER_EVENT_KEY,
      );

      if (!storedEvent) {
        setGoalIncreaseBanner(null);
        return;
      }

      const parsedEvent = JSON.parse(
        storedEvent,
      ) as Partial<GoalIncreaseBannerEvent>;
      const oldGoal = parsedEvent.oldGoal;
      const newGoal = parsedEvent.newGoal;
      const timestamp = parsedEvent.timestamp;
      const isValidEvent =
        typeof oldGoal === "number" &&
        typeof newGoal === "number" &&
        typeof timestamp === "string";

      if (!isValidEvent) {
        await AsyncStorage.removeItem(GOAL_INCREASE_BANNER_EVENT_KEY);
        setGoalIncreaseBanner(null);
        return;
      }

      setGoalIncreaseBanner({
        oldGoal,
        newGoal,
        timestamp,
      });
    } catch (error) {
      console.error("Failed to load goal increase banner event:", error);
      setGoalIncreaseBanner(null);
    }
  };

  const dismissGoalIncreaseBanner = async () => {
    setGoalIncreaseBanner(null);

    try {
      await AsyncStorage.removeItem(GOAL_INCREASE_BANNER_EVENT_KEY);
    } catch (error) {
      console.error("Failed to clear goal increase banner event:", error);
    }
  };

  const loadTodayProgress = async () => {
    try {
      const minutes = await getTodayReadingMinutes();
      setTodayMinutes(minutes);
    } catch (e) {
      console.error("Error loading today progress:", e);
      setTodayMinutes(0);
    }
  };

  // Calculate reading progress - only count 'read' books
  const booksRead = books.filter(
    (book) => book.reading_status === "read",
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
  const currentBook =
    books.find((book) => book.reading_status === "currently_reading") ||
    books[0] ||
    null;

  const renderBook = ({ item }: { item: EnhancedBook }) => (
    <BookCard book={item} compact={true} refreshTrigger={refreshTrigger} />
  );

  const handleReadingLoggerSuccess = () => {
    loadTodayProgress();
    // Refresh books data to trigger BookCard re-renders with updated progress
    loadData();
    // Increment refresh trigger to force BookCard re-renders
    setRefreshTrigger((prev) => prev + 1);
  };
  const topPart = () => (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("home.title")}</Text>
        {userPreferences && (
          <Text style={styles.subtitle}>
            {t("home.welcomeBack", { username: userPreferences.username })}
          </Text>
        )}
      </View>

      {goalIncreaseBanner && (
        <View style={styles.goalUpdateBanner}>
          <View style={styles.goalUpdateBannerContent}>
            <Text style={styles.goalUpdateBannerTitle}>
              {t("home.goalUpdateBanner.title")}
            </Text>
            <Text style={styles.goalUpdateBannerBody}>
              {t("home.goalUpdateBanner.body", {
                oldGoal: goalIncreaseBanner.oldGoal,
                newGoal: goalIncreaseBanner.newGoal,
              })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.goalUpdateBannerDismissButton}
            onPress={dismissGoalIncreaseBanner}
          >
            <Text style={styles.goalUpdateBannerDismissText}>
              {t("home.goalUpdateBanner.dismiss")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Continue Reading Hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroEyebrow}>{t("home.reading")}</Text>
        </View>

        {currentBook ? (
          <>
            <View style={styles.heroBookRow}>
              {currentBook.cover_url ? (
                <Image
                  source={{ uri: currentBook.cover_url }}
                  style={styles.heroCover}
                  defaultSource={require("../../../assets/images/icon.png")}
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
            </View>

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
            <Text style={styles.heroEmptyTitle}>{t("home.noBooksYet")}</Text>
            <Link href={"/(books)" as any} asChild>
              <TouchableOpacity style={styles.heroPrimaryButton}>
                <Text style={styles.heroPrimaryButtonText}>
                  {t("home.discoverBooks")}
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
      />

      <View style={styles.actionsRow}>
        <Link href={"/readinglogs"} asChild>
          <TouchableOpacity style={styles.secondaryActionButton}>
            <Text style={styles.secondaryActionButtonText}>
              {t("home.viewReadingLogs")}
            </Text>
          </TouchableOpacity>
        </Link>
        <Link href={"/(books)" as any} asChild>
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
          <Link href={"/(books)" as any} asChild>
            <TouchableOpacity style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>{t("home.seeAll")}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
  const TopPart = topPart;

  return (
    <View style={styles.container}>
      <FlatList
        key={`books-list-${refreshTrigger}`}
        data={books.slice(0, 4)} // Show only recent 4 books
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderBook}
        ListHeaderComponent={<TopPart />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>{t("home.noBooksYet")}</Text>
            <Text style={styles.emptySubtitle}>
              {t("home.startDiscovering")}
            </Text>
            <Link href={"/(books)" as any} asChild>
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
        onSuccess={handleReadingLoggerSuccess}
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
  goalUpdateBanner: {
    marginHorizontal: SPACING[4],
    marginBottom: SPACING[3],
    backgroundColor: COLORS.state.primarySoftAlt,
    borderWidth: 1,
    borderColor: COLORS.state.successBorder,
    borderRadius: 12,
    padding: SPACING[3],
    gap: SPACING[2],
  },
  goalUpdateBannerContent: {
    gap: 4,
  },
  goalUpdateBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.accent.strong,
  },
  goalUpdateBannerBody: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  goalUpdateBannerDismissButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface.raised,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  goalUpdateBannerDismissText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.accent.strong,
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
