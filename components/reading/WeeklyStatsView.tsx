import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useWeeklyStats } from "../../hooks/useWeeklyStats";
import { COLORS } from "../../themes/colors";
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
  const { stats, loading, dailyGoal } = useWeeklyStats({ weekStart });
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = t(
      `components.readingLogs.months.${date.toLocaleString("en", { month: "long" }).toLowerCase()}`,
    );
    return `${month} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}${t("components.readingLogs.minutesSuffix")}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
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
              {formatDate(stats.weekStart)} - {formatDate(stats.weekEnd)}
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
            {formatMinutes(stats.totalMinutes)}
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
            {stats.dailyBreakdown.map((day) => {
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
                  {formatMinutes(stats.topBook.minutesRead)} •{" "}
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
                    {formatMinutes(item.minutes)} ({Math.round(item.percentage)}
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
