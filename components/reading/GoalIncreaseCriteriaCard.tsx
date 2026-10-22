import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";

type GoalIncreaseCriteriaCardProps = {
  autoIncreaseEnabled: boolean;
  currentDailyGoal: number | null;
  goalMetDays: number;
  activeDays: number;
  requiredGoalMetDays: number;
  windowDays: number;
  loading?: boolean;
  showProgress?: boolean;
  compact?: boolean;
  isNewUser?: boolean;
};

const buildWeekVisual = (
  goalMetDays: number,
  requiredGoalMetDays: number,
  windowDays: number,
) => {
  const normalizedGoalMetDays = Math.max(0, Math.min(goalMetDays, windowDays));
  const normalizedRequiredDays = Math.max(
    0,
    Math.min(requiredGoalMetDays, windowDays),
  );

  return Array.from({ length: windowDays }, (_, index) => {
    if (index < normalizedGoalMetDays) {
      return "met";
    }

    if (index < normalizedRequiredDays) {
      return "needed";
    }

    return "extra";
  });
};

export default function GoalIncreaseCriteriaCard({
  autoIncreaseEnabled,
  currentDailyGoal,
  goalMetDays,
  activeDays,
  requiredGoalMetDays,
  windowDays,
  loading = false,
  showProgress = true,
  compact = false,
  isNewUser = false,
}: GoalIncreaseCriteriaCardProps) {
  const { t } = useTranslation();

  const daysLeft = Math.max(0, requiredGoalMetDays - goalMetDays);
  const weekVisual = buildWeekVisual(goalMetDays, requiredGoalMetDays, windowDays);

  const statusLabel = loading
    ? t("goalIncreaseCriteria.status.loading")
    : !autoIncreaseEnabled
      ? t("goalIncreaseCriteria.status.disabled")
      : isNewUser
        ? t("goalIncreaseCriteria.status.newUser")
        : daysLeft === 0
          ? t("goalIncreaseCriteria.status.eligible")
          : t("goalIncreaseCriteria.status.inProgress", {
              remaining: daysLeft,
            });

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Text style={styles.title}>{t("goalIncreaseCriteria.title")}</Text>
      <Text style={styles.subtitle}>
        {t("goalIncreaseCriteria.rule", {
          required: requiredGoalMetDays,
          total: windowDays,
        })}
      </Text>

      {showProgress && (
        <>
          <View style={styles.row}>
            <Text style={styles.progressLabel}>
              {t("goalIncreaseCriteria.progress", {
                met: goalMetDays,
                required: requiredGoalMetDays,
              })}
            </Text>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>

          <View style={styles.weekTrack}>
            {weekVisual.map((segment, index) => (
              <View
                key={`week-dot-${index}`}
                style={[
                  styles.weekDot,
                  segment === "met" && styles.weekDotMet,
                  segment === "needed" && styles.weekDotNeeded,
                  segment === "extra" && styles.weekDotExtra,
                ]}
              />
            ))}
          </View>
        </>
      )}

      <Text style={styles.helperText}>
        {autoIncreaseEnabled
          ? t("goalIncreaseCriteria.helperOn", {
              currentGoal: currentDailyGoal ?? 0,
              activeDays,
            })
          : t("goalIncreaseCriteria.helperOff")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: COLORS.surface.raised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
    padding: SPACING[3],
    gap: SPACING[2],
  },
  cardCompact: {
    padding: SPACING[2],
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.text.secondary,
    lineHeight: 17,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: "600",
  },
  statusText: {
    fontSize: 12,
    color: COLORS.accent.strong,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
  },
  weekTrack: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  weekDot: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  weekDotMet: {
    backgroundColor: COLORS.state.successSoft,
    borderColor: COLORS.state.successBorder,
  },
  weekDotNeeded: {
    backgroundColor: COLORS.state.warningSoft,
    borderColor: COLORS.state.warningBorder,
  },
  weekDotExtra: {
    backgroundColor: COLORS.neutral[100],
    borderColor: COLORS.neutral[200],
  },
  helperText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    lineHeight: 16,
  },
});
