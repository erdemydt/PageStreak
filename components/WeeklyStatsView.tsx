import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getDailyGoal } from "../db/repos/preferences";
import { getDailyTotals, listSessionsWithBooks } from "../db/repos/sessions";
import { COLORS } from "../themes/colors";
import { dateToLocalDateString, parseDbDate } from "../utils/dateUtils";
import { GoalForDate, loadGoalForDate } from "../utils/goalHistory";
import { calculateStreaks } from "../utils/readingProgress";
import { formatDate, formatDuration, LONG_DATE } from "../utils/format";

interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  averageMinutesPerDay: number;
  readingDays: number;
  sessionsCount: number;
  booksRead: string[];
  dailyBreakdown: DailyStats[];
  goalProgress: number;
  streakInfo: StreakInfo;
  topBook: BookStats | null;
  readingTimeDistribution: TimeDistribution[];
}

interface DailyStats {
  date: string;
  dayName: string;
  minutes: number;
  sessions: number;
  goalMet: boolean;
}

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  streakThisWeek: number;
}

interface BookStats {
  bookName: string;
  bookAuthor: string;
  minutesRead: number;
  sessionsCount: number;
}

interface TimeDistribution {
  timeRange: string;
  minutes: number;
  percentage: number;
}

const barMaxHeight = 120;

interface WeeklyStatsViewProps {
  weekStart: Date;
  onNavigateWeek: (direction: "prev" | "next") => void;
  onGoToCurrentWeek: () => void;
}

export default function WeeklyStatsView({
  weekStart,
  onNavigateWeek,
  onGoToCurrentWeek,
}: WeeklyStatsViewProps) {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(30);
  const { t } = useTranslation();

  const loadWeeklyStats = useCallback(async () => {
    try {
      setLoading(true);

      const goalMinutes = await getDailyGoal();
      setDailyGoal(goalMinutes);
      const goalForDate = await loadGoalForDate();

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const startDateString = dateToLocalDateString(weekStart);
      const endDateString = dateToLocalDateString(weekEnd);

      const sessions = await listSessionsWithBooks(
        startDateString,
        endDateString,
      );

      // Calculate daily breakdown
      const dailyBreakdown = getDailyBreakdown(
        weekStart,
        sessions,
        goalForDate,
      );

      // Calculate total minutes
      const totalMinutes = sessions.reduce(
        (sum, session) => sum + session.minutes_read,
        0,
      );

      // Calculate reading days (days with at least one session)
      const readingDaysSet = new Set(sessions.map((session) => session.date));
      const readingDays = readingDaysSet.size;

      // Calculate average minutes per reading day (not per total days)
      const averageMinutesPerDay = readingDays > 0 ? totalMinutes / 7 : 0;

      // Get unique books read this week
      const uniqueBooks = [
        ...new Set(
          sessions.map(
            (session) => `${session.book_name} by ${session.book_author}`,
          ),
        ),
      ];

      // Calculate goal progress (weekly goal is daily goal * 7)
      // Sum of each day's goal, so past weeks use the goal of that week
      const weeklyGoal = dailyBreakdown.reduce(
        (sum, day) => sum + goalForDate(day.date),
        0,
      );
      const goalProgress =
        weeklyGoal > 0 ? (totalMinutes / weeklyGoal) * 100 : 0;

      // Calculate streak info
      const streakInfo = await calculateStreakInfo(
        startDateString,
        endDateString,
        goalForDate,
      );

      // Find top book (most minutes read this week)
      const topBook = getTopBook(sessions);

      // Calculate reading time distribution
      const timeDistribution = getTimeDistribution(sessions);

      const weeklyStats: WeeklyStats = {
        weekStart: startDateString,
        weekEnd: endDateString,
        totalMinutes,
        averageMinutesPerDay,
        readingDays,
        sessionsCount: sessions.length,
        booksRead: uniqueBooks,
        dailyBreakdown,
        goalProgress,
        streakInfo,
        topBook,
        readingTimeDistribution: timeDistribution,
      };

      setStats(weeklyStats);
    } catch (error) {
      console.error("Error loading weekly stats:", error);
    } finally {
      setLoading(false);
    }
    // weekStart is a fresh Date object on every parent render; key on its value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime()]);

  useEffect(() => {
    loadWeeklyStats();
  }, [loadWeeklyStats]);

  const getDailyBreakdown = (
    weekStart: Date,
    sessions: any[],
    goalForDate: GoalForDate,
  ): DailyStats[] => {
    const dailyStats: DailyStats[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateString = dateToLocalDateString(date);

      const daySessions = sessions.filter(
        (session) => session.date === dateString,
      );
      const dayMinutes = daySessions.reduce(
        (sum, session) => sum + session.minutes_read,
        0,
      );

      dailyStats.push({
        date: dateString,
        dayName: getLocalizedWeekday(date),
        minutes: dayMinutes,
        sessions: daySessions.length,
        goalMet: dayMinutes >= goalForDate(dateString),
      });
    }

    return dailyStats;
  };

  const calculateStreakInfo = async (
    startDate: string,
    endDate: string,
    goalForDate: GoalForDate,
  ): Promise<StreakInfo> => {
    // Get all daily totals for streak calculation
    const dailyTotals = await getDailyTotals(endDate);

    const { currentStreak, longestStreak } = calculateStreaks(
      dailyTotals,
      goalForDate,
    );

    // Days within this week that met the goal
    const streakThisWeek = dailyTotals.filter(
      (day) =>
        day.total_minutes >= goalForDate(day.date) &&
        day.date >= startDate &&
        day.date <= endDate,
    ).length;

    return {
      currentStreak,
      longestStreak,
      streakThisWeek,
    };
  };

  const getTopBook = (sessions: any[]): BookStats | null => {
    if (sessions.length === 0) return null;

    const bookStats = sessions.reduce(
      (acc, session) => {
        const key = `${session.book_name}|||${session.book_author}`;
        if (!acc[key]) {
          acc[key] = {
            bookName: session.book_name,
            bookAuthor: session.book_author,
            minutesRead: 0,
            sessionsCount: 0,
          };
        }
        acc[key].minutesRead += session.minutes_read;
        acc[key].sessionsCount++;
        return acc;
      },
      {} as Record<string, BookStats>,
    );

    const books = Object.values(bookStats) as BookStats[];
    if (books.length === 0) return null;

    return books.reduce((top: BookStats, book: BookStats) =>
      book.minutesRead > top.minutesRead ? book : top,
    );
  };

  const getTimeDistribution = (sessions: any[]): TimeDistribution[] => {
    const ranges: Record<string, number> = {
      [t("components.weeklyStats.timeMorning")]: 0,
      [t("components.weeklyStats.timeAfternoon")]: 0,
      [t("components.weeklyStats.timeEvening")]: 0,
      [t("components.weeklyStats.timeNight")]: 0,
    };
    const [morning, afternoon, evening, night] = Object.keys(ranges);

    sessions.forEach((session) => {
      // created_at is a UTC SQLite timestamp; parse it as UTC to get the local hour
      const createdAt = parseDbDate(session.created_at);
      if (!createdAt) return;
      const hour = createdAt.getHours();
      if (hour >= 6 && hour < 12) {
        ranges[morning] += session.minutes_read;
      } else if (hour >= 12 && hour < 17) {
        ranges[afternoon] += session.minutes_read;
      } else if (hour >= 17 && hour < 21) {
        ranges[evening] += session.minutes_read;
      } else {
        ranges[night] += session.minutes_read;
      }
    });

    const total = Object.values(ranges).reduce((sum, val) => sum + val, 0);

    return Object.entries(ranges).map(([timeRange, minutes]) => ({
      timeRange,
      minutes,
      percentage: total > 0 ? (minutes / total) * 100 : 0,
    }));
  };

  const getLocalizedWeekday = (date: Date): string => {
    const dayIndex = date.getDay();
    const mondayFirstIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    return t(`components.readingLogs.weekdays.${weekdays[mondayFirstIndex]}`);
  };

  if (loading || !stats) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>
          {t("components.readingLogs.loadingText")}
        </Text>
      </View>
    );
  }

  const maxMinutes = Math.max(
    ...stats.dailyBreakdown.map((day) => day.minutes),
    dailyGoal,
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity
            onPress={() => onNavigateWeek("prev")}
            style={styles.navButton}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={COLORS.neutral[700]}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={onGoToCurrentWeek} style={styles.weekInfo}>
            <Text style={styles.weekRange}>
              {formatDate(stats.weekStart, LONG_DATE)} -{" "}
              {formatDate(stats.weekEnd, LONG_DATE)}
            </Text>
            <Text style={styles.weekTotal}>
              📊 {t("components.weeklyStats.weeklyAnalytics")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onNavigateWeek("next")}
            style={styles.navButton}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.neutral[700]}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="time" size={24} color={COLORS.primary} />
          </View>
          <Text style={styles.summaryValue}>
            {formatDuration(stats.totalMinutes)}
          </Text>
          <Text style={styles.summaryLabel}>
            {t("components.weeklyStats.totalReading")}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="calendar" size={24} color={COLORS.success} />
          </View>
          <Text style={styles.summaryValue}>{stats.readingDays}/7</Text>
          <Text style={styles.summaryLabel}>
            {t("components.weeklyStats.activeDays")}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="flame" size={24} color={COLORS.warning} />
          </View>
          <Text style={styles.summaryValue}>
            {stats.streakInfo.streakThisWeek}
          </Text>
          <Text style={styles.summaryLabel}>
            {t("components.weeklyStats.streakDays")}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="library" size={24} color={COLORS.danger} />
          </View>
          <Text style={styles.summaryValue}>{stats.booksRead.length}</Text>
          <Text style={styles.summaryLabel}>
            {t("components.weeklyStats.booksRead")}
          </Text>
        </View>
      </View>

      {/* Daily Reading Chart */}
      <View style={styles.chartSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bar-chart" size={20} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>
            {t("components.weeklyStats.dailyBreakdown")}
          </Text>
        </View>

        <View style={styles.chartContainer}>
          <View style={styles.chartArea}>
            {stats.dailyBreakdown.map((day, index) => {
              const barHeight =
                maxMinutes > 0 ? (day.minutes / maxMinutes) * barMaxHeight : 0;
              const goalHeight =
                maxMinutes > 0 ? (dailyGoal / maxMinutes) * barMaxHeight : 0;

              return (
                <View key={day.date} style={styles.barContainer}>
                  <View style={styles.barColumn}>
                    <Text style={styles.barValue}>
                      {day.minutes > 0
                        ? ` ${day.minutes} ${t("components.readingLogs.minutesSuffix")}`
                        : ""}
                    </Text>
                    <View
                      style={[styles.bar, { height: Math.max(barHeight, 4) }]}
                    >
                      <View
                        style={[
                          styles.barFill,
                          {
                            backgroundColor: day.goalMet
                              ? COLORS.success
                              : COLORS.primary,
                            height: "100%",
                          },
                        ]}
                      />
                    </View>
                    {/* Goal line */}
                    <View style={[styles.goalLine, { bottom: goalHeight }]} />
                  </View>
                  <Text style={styles.barLabel}>{day.dayName}</Text>
                  <View style={styles.barFooter}>
                    <Text style={styles.sessionsCount}>
                      {day.sessions > 0 ? `${day.sessions} 📝` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendColor,
                  { backgroundColor: COLORS.primary },
                ]}
              />
              <Text style={styles.legendText}>
                {t("components.weeklyStats.readingTime")}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendColor,
                  { backgroundColor: COLORS.success },
                ]}
              />
              <Text style={styles.legendText}>
                {t("components.weeklyStats.goalMet")}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.goalLineLegend} />
              <Text style={styles.legendText}>
                {t("components.weeklyStats.dailyGoal")} ({dailyGoal}m)
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Progress Stats */}
      <View style={styles.statsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="analytics" size={20} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>
            {t("components.weeklyStats.progressStats")}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {Math.round(stats.goalProgress)}%
            </Text>
            <Text style={styles.statLabel}>
              {t("components.weeklyStats.weeklyGoalProgress")}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(stats.goalProgress, 100)}%` },
                ]}
              />
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {Math.round(stats.averageMinutesPerDay)}
            </Text>
            <Text style={styles.statLabel}>
              {t("components.weeklyStats.averagePerDay")}
            </Text>
            <Text style={styles.statNote}>
              {t("components.readingLogs.minutesSuffix")}/
              {t("components.weeklyStats.day")}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.streakInfo.currentStreak}
            </Text>
            <Text style={styles.statLabel}>
              {t("components.weeklyStats.currentStreak")}
            </Text>
            <Text style={styles.statNote}>
              {t("components.weeklyStats.days")}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.sessionsCount}</Text>
            <Text style={styles.statLabel}>
              {t("components.weeklyStats.totalSessions")}
            </Text>
            <Text style={styles.statNote}>
              {stats.sessionsCount > 0
                ? Math.round(stats.totalMinutes / stats.sessionsCount)
                : 0}
              {t("components.readingLogs.minutesSuffix")}/
              {t("components.weeklyStats.session")}
            </Text>
          </View>
        </View>
      </View>

      {/* Top Book This Week */}
      {stats.topBook && (
        <View style={styles.topBookSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={20} color={COLORS.warning} />
            <Text style={styles.sectionTitle}>
              {t("components.weeklyStats.topBookThisWeek")}
            </Text>
          </View>

          <View style={styles.topBookCard}>
            <View style={styles.topBookIcon}>
              <Ionicons name="book" size={32} color={COLORS.warning} />
            </View>
            <View style={styles.topBookInfo}>
              <Text style={styles.topBookTitle}>{stats.topBook.bookName}</Text>
              <Text style={styles.topBookAuthor}>
                {t("components.readingLogs.sessionCardBy")}{" "}
                {stats.topBook.bookAuthor}
              </Text>
              <View style={styles.topBookStats}>
                <Text style={styles.topBookStat}>
                  {formatDuration(stats.topBook.minutesRead)} •{" "}
                  {stats.topBook.sessionsCount}{" "}
                  {t("components.weeklyStats.sessions")}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Reading Time Distribution */}
      <View style={styles.distributionSection}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="pie-chart"
            size={20}
            color={COLORS.state.readingHeat4}
          />
          <Text style={styles.sectionTitle}>
            {t("components.weeklyStats.readingTimeDistribution")}
          </Text>
        </View>

        <View style={styles.distributionChart}>
          {stats.readingTimeDistribution.map((item, index) => {
            if (item.minutes === 0) return null;

            return (
              <View key={index} style={styles.distributionItem}>
                <View style={styles.distributionInfo}>
                  <Text style={styles.distributionLabel}>{item.timeRange}</Text>
                  <Text style={styles.distributionValue}>
                    {formatDuration(item.minutes)} (
                    {Math.round(item.percentage)}
                    %)
                  </Text>
                </View>
                <View style={styles.distributionBar}>
                  <View
                    style={[
                      styles.distributionFill,
                      {
                        width: `${item.percentage}%`,
                        backgroundColor: [
                          COLORS.primary,
                          COLORS.success,
                          COLORS.warning,
                          COLORS.danger,
                        ][index % 4],
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Insights */}
      <View style={styles.insightsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bulb" size={20} color={COLORS.state.accentCyan} />
          <Text style={styles.sectionTitle}>
            {t("components.weeklyStats.insights")}
          </Text>
        </View>

        <View style={styles.insightsContainer}>
          {stats.goalProgress >= 100 && (
            <View style={styles.insightCard}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={COLORS.success}
              />
              <Text style={styles.insightText}>
                {t("components.weeklyStats.weeklyGoalAchieved")}
              </Text>
            </View>
          )}

          {stats.streakInfo.currentStreak >= 7 && (
            <View style={styles.insightCard}>
              <Ionicons name="flame" size={20} color={COLORS.warning} />
              <Text style={styles.insightText}>
                {t("components.weeklyStats.greatStreak", {
                  streak: stats.streakInfo.currentStreak,
                })}
              </Text>
            </View>
          )}

          {stats.readingDays >= 6 && (
            <View style={styles.insightCard}>
              <Ionicons
                name="star"
                size={20}
                color={COLORS.state.readingHeat4}
              />
              <Text style={styles.insightText}>
                {t("components.weeklyStats.consistentReader")}
              </Text>
            </View>
          )}

          {stats.booksRead.length >= 3 && (
            <View style={styles.insightCard}>
              <Ionicons
                name="library"
                size={20}
                color={COLORS.state.accentRose}
              />
              <Text style={styles.insightText}>
                {t("components.weeklyStats.diverseReader", {
                  count: stats.booksRead.length,
                })}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
  },
  weekNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  weekInfo: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 16,
  },
  weekRange: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 4,
  },
  weekTotal: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
  summaryCards: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral[50],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.neutral[800],
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.neutral[500],
    textAlign: "center",
    fontWeight: "500",
  },
  chartSection: {
    margin: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.neutral[800],
    marginLeft: 8,
  },
  chartContainer: {
    alignItems: "center",
  },
  chartArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: barMaxHeight + 40,
    width: "100%",
    position: "relative",
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 2,
  },
  barColumn: {
    alignItems: "center",
    position: "relative",
    width: "100%",
  },
  barValue: {
    fontSize: 10,
    color: COLORS.neutral[500],
    fontWeight: "600",
    marginBottom: 4,
    height: 12,
  },
  bar: {
    width: "80%",
    backgroundColor: COLORS.neutral[100],
    borderRadius: 4,
    minHeight: 4,
    justifyContent: "flex-end",
    position: "relative",
  },
  barFill: {
    borderRadius: 4,
    minHeight: 4,
  },
  goalLine: {
    position: "absolute",
    left: "-10%",
    right: "-10%",
    height: 2,
    backgroundColor: COLORS.warning,
    borderRadius: 1,
  },
  barLabel: {
    fontSize: 12,
    color: COLORS.neutral[500],
    fontWeight: "600",
    marginTop: 8,
  },
  barFooter: {
    height: 16,
    justifyContent: "center",
  },
  sessionsCount: {
    fontSize: 10,
    color: COLORS.neutral[400],
    textAlign: "center",
  },
  chartLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 20,
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  goalLineLegend: {
    width: 12,
    height: 2,
    backgroundColor: COLORS.warning,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  statsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: COLORS.neutral[50],
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.neutral[800],
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.neutral[500],
    textAlign: "center",
    fontWeight: "500",
    marginBottom: 8,
  },
  statNote: {
    fontSize: 10,
    color: COLORS.neutral[400],
    textAlign: "center",
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: COLORS.neutral[200],
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  topBookSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  topBookCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.state.warningSoft,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.state.warningBorder,
  },
  topBookIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  topBookInfo: {
    flex: 1,
  },
  topBookTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.neutral[800],
    marginBottom: 4,
  },
  topBookAuthor: {
    fontSize: 14,
    color: COLORS.neutral[500],
    marginBottom: 8,
  },
  topBookStats: {
    flexDirection: "row",
  },
  topBookStat: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: "600",
  },
  distributionSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  distributionChart: {
    gap: 12,
  },
  distributionItem: {
    backgroundColor: COLORS.neutral[50],
    borderRadius: 8,
    padding: 12,
  },
  distributionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  distributionLabel: {
    fontSize: 14,
    color: COLORS.neutral[800],
    fontWeight: "500",
  },
  distributionValue: {
    fontSize: 12,
    color: COLORS.neutral[500],
    fontWeight: "600",
  },
  distributionBar: {
    height: 6,
    backgroundColor: COLORS.neutral[200],
    borderRadius: 3,
    overflow: "hidden",
  },
  distributionFill: {
    height: "100%",
    borderRadius: 3,
  },
  insightsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  insightsContainer: {
    gap: 12,
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.neutral[50],
    borderRadius: 8,
    padding: 12,
  },
  insightText: {
    fontSize: 14,
    color: COLORS.neutral[800],
    fontWeight: "500",
    marginLeft: 8,
    flex: 1,
  },
  bottomSpacer: {
    height: 40,
  },
});
