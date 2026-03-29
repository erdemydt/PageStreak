import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../themes/colors";
import { SPACING } from "../themes/spacing";
import { TYPE } from "../themes/typography";
import Card from "./Card";

interface DailyProgressCardProps {
  todayMinutes: number;
  goalMinutes: number;
  streakDays: number;
}

export default function DailyProgressCard({
  todayMinutes,
  goalMinutes,
  streakDays,
}: DailyProgressCardProps) {
  const { t } = useTranslation();
  const percentage =
    goalMinutes > 0 ? Math.min((todayMinutes / goalMinutes) * 100, 100) : 0;
  const isGoalReached = todayMinutes >= goalMinutes;

  const formatMinutes = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours} ${t("settings.hours")} ${remainingMinutes} ${t("components.readingTimeLogger.minutesShort")}`
        : `${hours} ${t("settings.hours")}`;
    }
    return `${minutes} ${t("components.readingTimeLogger.minutesShort")}`;
  };

  const getMotivationMessage = () => {
    if (isGoalReached) {
      return t("components.dailyProgress.goalCrushed");
    } else if (percentage >= 75) {
      return t("components.dailyProgress.almostThere");
    } else if (percentage >= 50) {
      return t("components.dailyProgress.goodProgress");
    } else if (percentage >= 25) {
      return t("components.dailyProgress.greatStart");
    } else if (todayMinutes > 0) {
      return t("components.dailyProgress.everyMinute");
    } else {
      return t("components.dailyProgress.readyToStart");
    }
  };

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>
          {t("components.dailyProgress.title")}
        </Text>
        <Text style={styles.progressMeta}>{Math.round(percentage)}%</Text>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${percentage}%`,
                backgroundColor: isGoalReached
                  ? COLORS.success
                  : COLORS.accent.primary,
              },
            ]}
          />
        </View>
        <Text style={styles.remainingTextInline}>
          {isGoalReached
            ? t("components.dailyProgress.goalCrushed")
            : t("components.dailyProgress.leftToReach", {
                time: formatMinutes(goalMinutes - todayMinutes),
              })}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatMinutes(todayMinutes)}</Text>
          <Text style={styles.statLabel}>
            {t("components.dailyProgress.today")}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatMinutes(goalMinutes)}</Text>
          <Text style={styles.statLabel}>
            {t("components.dailyProgress.goal")}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streakDays}</Text>
          <Text style={styles.statLabel}>
            {t("components.dailyProgress.dayStreak")}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.motivationContainer,
          isGoalReached && styles.motivationContainerSuccess,
        ]}
      >
        <Text
          style={[
            styles.motivationText,
            isGoalReached && styles.motivationTextSuccess,
          ]}
        >
          {getMotivationMessage()}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING[2],
  },
  cardTitle: {
    ...TYPE.cardTitle,
  },
  progressMeta: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  progressBlock: {
    marginBottom: SPACING[3],
    gap: SPACING[2],
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORS.neutral[200],
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  remainingTextInline: {
    ...TYPE.meta,
    color: COLORS.text.secondary,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING[3],
  },
  statItem: {
    alignItems: "flex-start",
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  motivationContainer: {
    backgroundColor: COLORS.surface.muted,
    padding: SPACING[3],
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent.primary,
  },
  motivationContainerSuccess: {
    backgroundColor: COLORS.state.successSoft,
    borderLeftColor: COLORS.success,
  },
  motivationText: {
    fontSize: 13,
    color: COLORS.accent.strong,
    fontWeight: "500",
    textAlign: "left",
  },
  motivationTextSuccess: {
    color: COLORS.success,
  },
});
