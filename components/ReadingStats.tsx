import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../themes/colors";
import Card from "./Card";
interface ReadingStatsProps {
  weeklyMinutes: number[];
  monthlyGoal?: number;
  averageDaily?: number;
}

export default function ReadingStats({
  weeklyMinutes,
  monthlyGoal = 900, // 30 minutes * 30 days
  averageDaily,
}: ReadingStatsProps) {
  const { t } = useTranslation();
  const totalWeeklyMinutes = weeklyMinutes.reduce(
    (sum, minutes) => sum + minutes,
    0,
  );
  const avgDailyThisWeek = Math.round(totalWeeklyMinutes / 7);
  const weeklyGoal = 210; // 30 minutes * 7 days
  const weeklyProgress = Math.min((totalWeeklyMinutes / weeklyGoal) * 100, 100);

  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours} ${t("settings.hours")} ${remainingMinutes} ${t("components.readingTimeLogger.minutesShort")}`
        : `${hours} ${t("settings.hours")}`;
    }
    return `${minutes} ${t("components.readingTimeLogger.minutesShort")}`;
  };

  return (
    <Card style={styles.container}>
      <Text style={styles.title}>📊 This Week&apos;s Reading</Text>

      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatTime(totalWeeklyMinutes)}
            </Text>
            <Text style={styles.statLabel}>Total This Week</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTime(avgDailyThisWeek)}</Text>
            <Text style={styles.statLabel}>Daily Average</Text>
          </View>
        </View>

        {/* Weekly Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[styles.progressBarFill, { width: `${weeklyProgress}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(weeklyProgress)}% of weekly goal (
            {formatTime(weeklyGoal)})
          </Text>
        </View>

        {/* Daily Breakdown */}
        <View style={styles.dailyBreakdown}>
          <Text style={styles.breakdownTitle}>Daily Breakdown</Text>
          <View style={styles.dailyBars}>
            {weeklyMinutes.map((minutes, index) => {
              const dayNames = [
                "Sun",
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
              ];
              const today = new Date();
              const dayIndex = (today.getDay() - 6 + index) % 7;
              const isToday = index === 6; // Last item is today

              return (
                <View key={index} style={styles.dayBar}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max((minutes / 60) * 100, 5)}%`,
                          backgroundColor: isToday
                            ? COLORS.primary
                            : COLORS.neutral[200],
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>
                    {dayNames[dayIndex]}
                  </Text>
                  <Text style={styles.minutesLabel}>
                    {minutes} {t("components.readingTimeLogger.minutesShort")}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.neutral[800],
    marginBottom: 16,
  },
  statsContainer: {
    gap: 16,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.neutral[200],
  },
  progressContainer: {
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
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    color: COLORS.neutral[500],
    textAlign: "center",
    fontWeight: "500",
  },
  dailyBreakdown: {
    marginTop: 8,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.neutral[700],
    marginBottom: 12,
  },
  dailyBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 60,
    gap: 4,
  },
  dayBar: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  barContainer: {
    height: 40,
    width: "80%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 2,
    minHeight: 2,
  },
  dayLabel: {
    fontSize: 9,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  todayLabel: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  minutesLabel: {
    fontSize: 8,
    color: COLORS.neutral[400],
  },
});
