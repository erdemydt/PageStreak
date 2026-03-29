import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { queryAll, queryFirst } from "../../db/db";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import {
    updateGrowthGoals,
    validateGrowthGoals,
} from "../../utils/goalSettings";

type UserGoalPrefs = {
  created_at?: string;
  current_reading_rate_minutes_per_day?: number;
  end_reading_rate_goal_minutes_per_day?: number;
  end_reading_rate_goal_date?: string;
  initial_reading_rate_minutes_per_day?: number;
  weekly_reading_rate_increase_minutes?: number;
};

type ReadingSessionRow = {
  date: string;
  minutes_read: number;
};

type WeeklyPoint = {
  key: string;
  weekStart: Date;
  targetMinutes: number;
  actualMinutes: number;
  applicable: boolean;
};

const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7;
const RANGE_OPTIONS = [4, 12, 24] as const;

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getWeekStart = (baseDate: Date) => {
  const date = new Date(baseDate);
  const dayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayOffset);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addWeeks = (baseDate: Date, weeks: number) => {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + weeks * 7);
  return date;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const diffWeeks = (laterDate: Date, earlierDate: Date) =>
  Math.floor((laterDate.getTime() - earlierDate.getTime()) / MS_PER_WEEK);

const getTimelineStartDate = (
  createdAt?: string,
  firstReadingDate?: string | null,
) => {
  if (firstReadingDate) {
    return new Date(`${firstReadingDate}T00:00:00`);
  }

  if (createdAt) {
    return new Date(createdAt);
  }

  return new Date();
};

export default function ReadingGrowthScreen() {
  const { t } = useTranslation();
  const [weeklyData, setWeeklyData] = useState<WeeklyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [rangeWeeks, setRangeWeeks] =
    useState<(typeof RANGE_OPTIONS)[number]>(12);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>("");
  const [timelineStartWeek, setTimelineStartWeek] = useState<Date | null>(null);

  const [editedCurrentGoal, setEditedCurrentGoal] = useState("");
  const [editedTargetGoal, setEditedTargetGoal] = useState("");
  const [editedTargetDate, setEditedTargetDate] = useState("");

  const currentWeekStart = useMemo(() => getWeekStart(new Date()), []);

  const weekWindow = useMemo(() => {
    const endWeekStart = addWeeks(currentWeekStart, -offsetWeeks);
    const startWeekStart = addWeeks(endWeekStart, -(rangeWeeks - 1));

    const weeks: Date[] = [];
    for (let index = 0; index < rangeWeeks; index++) {
      weeks.push(addWeeks(startWeekStart, index));
    }

    return {
      weeks,
      startWeekStart,
      endWeekStart,
    };
  }, [currentWeekStart, offsetWeeks, rangeWeeks]);

  const maxOffsetWeeks = useMemo(() => {
    if (!timelineStartWeek) {
      return 0;
    }

    const totalWeeksSinceStart = Math.max(
      0,
      diffWeeks(currentWeekStart, timelineStartWeek),
    );
    return Math.max(0, totalWeeksSinceStart - (rangeWeeks - 1));
  }, [currentWeekStart, rangeWeeks, timelineStartWeek]);

  useEffect(() => {
    setOffsetWeeks((previous) => Math.min(previous, maxOffsetWeeks));
  }, [maxOffsetWeeks]);

  const loadGrowthData = useCallback(async () => {
    try {
      setLoading(true);

      const userPrefs = await queryFirst<UserGoalPrefs>(
        `SELECT
          created_at,
          current_reading_rate_minutes_per_day,
          end_reading_rate_goal_minutes_per_day,
          end_reading_rate_goal_date,
          initial_reading_rate_minutes_per_day,
          weekly_reading_rate_increase_minutes
         FROM user_preferences
         WHERE id = 1`,
      );

      const firstReadingData = await queryFirst<{ first_date: string | null }>(
        `SELECT MIN(date) as first_date
         FROM reading_sessions`,
      );

      const derivedTimelineStart = getWeekStart(
        getTimelineStartDate(
          userPrefs?.created_at,
          firstReadingData?.first_date,
        ),
      );
      const effectiveStartWeek =
        weekWindow.startWeekStart.getTime() < derivedTimelineStart.getTime()
          ? derivedTimelineStart
          : weekWindow.startWeekStart;

      setTimelineStartWeek(derivedTimelineStart);

      const startDateKey = toDateKey(effectiveStartWeek);
      const endDate = new Date(weekWindow.endWeekStart);
      endDate.setDate(endDate.getDate() + 6);
      const endDateKey = toDateKey(endDate);

      const rows = await queryAll<ReadingSessionRow>(
        `SELECT date, minutes_read
         FROM reading_sessions
         WHERE date BETWEEN ? AND ?`,
        [startDateKey, endDateKey],
      );

      const actualByWeek = new Map<string, number>();
      for (const row of rows) {
        const sessionDate = new Date(`${row.date}T00:00:00`);
        const sessionWeek = getWeekStart(sessionDate);
        const weekKey = toDateKey(sessionWeek);
        actualByWeek.set(
          weekKey,
          (actualByWeek.get(weekKey) || 0) + row.minutes_read,
        );
      }

      const currentRate = userPrefs?.current_reading_rate_minutes_per_day || 30;
      const targetRate =
        userPrefs?.end_reading_rate_goal_minutes_per_day || currentRate;
      const initialRate =
        userPrefs?.initial_reading_rate_minutes_per_day || currentRate;
      const weeklyIncrease =
        userPrefs?.weekly_reading_rate_increase_minutes || 0;

      const minRate = Math.min(initialRate, currentRate, targetRate);
      const maxRate = Math.max(initialRate, currentRate, targetRate);

      const renderedWeeks: Date[] = [];
      for (
        let weekCursor = new Date(effectiveStartWeek);
        weekCursor.getTime() <= weekWindow.endWeekStart.getTime();
        weekCursor = addWeeks(weekCursor, 1)
      ) {
        renderedWeeks.push(new Date(weekCursor));
      }

      const points = renderedWeeks.map((weekStart) => {
        const weekKey = toDateKey(weekStart);
        const weeksFromTimelineStart = Math.max(
          0,
          diffWeeks(weekStart, derivedTimelineStart),
        );

        let estimatedDailyRate = currentRate;
        if (weeklyIncrease > 0) {
          estimatedDailyRate =
            initialRate + weeksFromTimelineStart * weeklyIncrease;
        }

        const targetDailyRate = clamp(estimatedDailyRate, minRate, maxRate);

        return {
          key: weekKey,
          weekStart,
          targetMinutes: targetDailyRate * 7,
          actualMinutes: actualByWeek.get(weekKey) || 0,
          applicable: true,
        } as WeeklyPoint;
      });

      setWeeklyData(points);
      setEditedCurrentGoal(String(currentRate));
      setEditedTargetGoal(String(targetRate));
      setEditedTargetDate(
        userPrefs?.end_reading_rate_goal_date
          ? `${userPrefs.end_reading_rate_goal_date.slice(8, 10)}/${userPrefs.end_reading_rate_goal_date.slice(5, 7)}/${userPrefs.end_reading_rate_goal_date.slice(0, 4)}`
          : "",
      );

      const latestApplicable = [...points]
        .reverse()
        .find((point) => point.applicable);
      setSelectedWeekKey((current) =>
        points.some((point) => point.key === current)
          ? current
          : latestApplicable?.key || points[points.length - 1]?.key || "",
      );
    } catch (error) {
      console.error("Failed to load growth data:", error);
      Alert.alert(t("profile.error.title"), t("profile.error.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [
    currentWeekStart,
    t,
    weekWindow.endWeekStart,
    weekWindow.startWeekStart,
    weekWindow.weeks,
  ]);

  useEffect(() => {
    loadGrowthData();
  }, [loadGrowthData]);

  useFocusEffect(
    useCallback(() => {
      loadGrowthData();
    }, [loadGrowthData]),
  );

  const maxChartValue = useMemo(() => {
    const maxPoint = weeklyData.reduce(
      (max, point) => Math.max(max, point.actualMinutes, point.targetMinutes),
      1,
    );
    return Math.max(60, maxPoint);
  }, [weeklyData]);

  const selectedWeek = useMemo(
    () => weeklyData.find((point) => point.key === selectedWeekKey) || null,
    [selectedWeekKey, weeklyData],
  );

  const goalHitWeeks = useMemo(
    () =>
      weeklyData.filter(
        (point) =>
          point.applicable && point.actualMinutes >= point.targetMinutes,
      ).length,
    [weeklyData],
  );

  const averageVariance = useMemo(() => {
    const applicable = weeklyData.filter((point) => point.applicable);
    if (applicable.length === 0) {
      return 0;
    }

    const totalVariance = applicable.reduce(
      (sum, point) => sum + (point.actualMinutes - point.targetMinutes),
      0,
    );
    return Math.round(totalVariance / applicable.length);
  }, [weeklyData]);

  const trendDirection = useMemo(() => {
    const applicable = weeklyData.filter((point) => point.applicable);
    if (applicable.length < 2) {
      return "flat";
    }

    const firstHalf = applicable.slice(0, Math.floor(applicable.length / 2));
    const secondHalf = applicable.slice(Math.floor(applicable.length / 2));

    const firstAverage =
      firstHalf.reduce((sum, point) => sum + point.actualMinutes, 0) /
      Math.max(1, firstHalf.length);
    const secondAverage =
      secondHalf.reduce((sum, point) => sum + point.actualMinutes, 0) /
      Math.max(1, secondHalf.length);

    if (secondAverage > firstAverage + 5) {
      return "up";
    }
    if (secondAverage < firstAverage - 5) {
      return "down";
    }
    return "flat";
  }, [weeklyData]);

  const formatWeekLabel = (date: Date) => {
    return `${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}`;
  };

  const saveGrowthSettings = async () => {
    const currentDailyGoal = Number(editedCurrentGoal);
    const targetDailyGoal = Number(editedTargetGoal);

    const validation = validateGrowthGoals({
      currentDailyGoal,
      targetDailyGoal,
      targetDate: editedTargetDate || null,
    });

    if (validation) {
      const messageKey =
        validation === "current_daily_required" ||
        validation === "current_daily_range"
          ? "profile.validation.dailyGoalRequired"
          : "profile.validation.targetGoalRequired";

      Alert.alert(t("profile.error.title"), t(messageKey));
      return;
    }

    setSaving(true);
    try {
      await updateGrowthGoals({
        currentDailyGoal,
        targetDailyGoal,
        targetDate: editedTargetDate || null,
      });
      await loadGrowthData();
      Alert.alert(t("profile.success.title"), t("growthJourney.success"));
    } catch (error) {
      console.error("Failed to save growth settings:", error);
      Alert.alert(t("profile.error.title"), t("profile.error.message"));
    } finally {
      setSaving(false);
    }
  };

  const onRangeChange = (range: (typeof RANGE_OPTIONS)[number]) => {
    setRangeWeeks(range);
    setOffsetWeeks((previous) => Math.min(previous, maxOffsetWeeks));
  };

  const xAxisLabelStep = useMemo(() => {
    if (weeklyData.length >= 18) {
      return 4;
    }
    if (weeklyData.length >= 10) {
      return 2;
    }
    return 1;
  }, [weeklyData.length]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>{t("growthJourney.title")}</Text>
        <Text style={styles.subtitle}>{t("growthJourney.subtitle")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t("growthJourney.controls.range")}
        </Text>
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.rangeChip,
                rangeWeeks === range && styles.rangeChipActive,
              ]}
              onPress={() => onRangeChange(range)}
            >
              <Text
                style={[
                  styles.rangeChipText,
                  rangeWeeks === range && styles.rangeChipTextActive,
                ]}
              >
                {t("growthJourney.controls.weeks", { count: range })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.navigationRow}>
          <TouchableOpacity
            style={[
              styles.navButton,
              offsetWeeks >= maxOffsetWeeks && styles.navButtonDisabled,
            ]}
            onPress={() =>
              setOffsetWeeks((prev) => Math.min(maxOffsetWeeks, prev + 1))
            }
            disabled={offsetWeeks >= maxOffsetWeeks}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={COLORS.text.primary}
            />
            <Text style={styles.navButtonText}>
              {t("growthJourney.controls.prev")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navButton,
              offsetWeeks === 0 && styles.navButtonDisabled,
            ]}
            onPress={() => setOffsetWeeks((prev) => Math.max(0, prev - 1))}
            disabled={offsetWeeks === 0}
          >
            <Text style={styles.navButtonText}>
              {t("growthJourney.controls.next")}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.text.primary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.jumpButton}
          onPress={() => setOffsetWeeks(0)}
          disabled={offsetWeeks === 0}
        >
          <Text style={styles.jumpButtonText}>
            {t("growthJourney.controls.current")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: COLORS.warning }]}
            />
            <Text style={styles.legendLabel}>
              {t("growthJourney.chart.target")}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: COLORS.primary }]}
            />
            <Text style={styles.legendLabel}>
              {t("growthJourney.chart.actual")}
            </Text>
          </View>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>{t("growthJourney.loading")}</Text>
        ) : (
          <View style={styles.chartRow}>
            {weeklyData.map((point, index) => {
              const targetHeight = Math.max(
                2,
                (point.targetMinutes / maxChartValue) * 120,
              );
              const actualHeight = Math.max(
                2,
                (point.actualMinutes / maxChartValue) * 120,
              );

              const isSelected = selectedWeekKey === point.key;

              return (
                <TouchableOpacity
                  key={point.key}
                  style={styles.weekColumn}
                  onPress={() => setSelectedWeekKey(point.key)}
                >
                  <View
                    style={[
                      styles.barsWrap,
                      isSelected && styles.barsWrapSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.bar,
                        {
                          height: targetHeight,
                          backgroundColor: COLORS.warning,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        {
                          height: point.applicable ? actualHeight : 2,
                          backgroundColor: point.applicable
                            ? COLORS.primary
                            : COLORS.neutral[300],
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {!loading ? (
          <View style={styles.xAxisRow}>
            {weeklyData.map((point, index) => {
              const showLabel =
                index % xAxisLabelStep === 0 || index === weeklyData.length - 1;
              return (
                <View key={`${point.key}-label`} style={styles.xAxisLabelSlot}>
                  <Text style={styles.xAxisLabelText}>
                    {showLabel ? formatWeekLabel(point.weekStart) : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t("growthJourney.summary.title")}
        </Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>
              {t("growthJourney.summary.goalHit")}
            </Text>
            <Text style={styles.summaryValue}>
              {goalHitWeeks}/
              {weeklyData.filter((point) => point.applicable).length}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>
              {t("growthJourney.summary.avgVariance")}
            </Text>
            <Text style={styles.summaryValue}>
              {averageVariance >= 0 ? "+" : ""}
              {averageVariance}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>
              {t("growthJourney.summary.trend")}
            </Text>
            <Text style={styles.summaryValue}>
              {trendDirection === "up"
                ? t("growthJourney.summary.trendUp")
                : trendDirection === "down"
                  ? t("growthJourney.summary.trendDown")
                  : t("growthJourney.summary.trendFlat")}
            </Text>
          </View>
        </View>

        {selectedWeek ? (
          <View style={styles.selectedWeekCard}>
            <Text style={styles.selectedWeekTitle}>
              {t("growthJourney.summary.weekOf", {
                date: formatWeekLabel(selectedWeek.weekStart),
              })}
            </Text>
            <Text style={styles.selectedWeekLine}>
              {t("growthJourney.chart.target")}:{" "}
              {Math.round(selectedWeek.targetMinutes)}{" "}
              {t("profile.units.minutes")}
            </Text>
            <Text style={styles.selectedWeekLine}>
              {t("growthJourney.chart.actual")}:{" "}
              {Math.round(selectedWeek.actualMinutes)}{" "}
              {t("profile.units.minutes")}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("growthJourney.edit.title")}</Text>
        <Text style={styles.editHint}>{t("growthJourney.edit.subtitle")}</Text>

        <Text style={styles.inputLabel}>
          {t("profile.fields.currentDailyGoal")}
        </Text>
        <TextInput
          style={styles.input}
          value={editedCurrentGoal}
          onChangeText={setEditedCurrentGoal}
          keyboardType="numeric"
          placeholder={t("profile.placeholders.dailyGoal")}
        />

        <Text style={styles.inputLabel}>
          {t("profile.fields.targetDailyGoal")}
        </Text>
        <TextInput
          style={styles.input}
          value={editedTargetGoal}
          onChangeText={setEditedTargetGoal}
          keyboardType="numeric"
          placeholder={t("profile.placeholders.targetGoal")}
        />

        <Text style={styles.inputLabel}>
          {t("growthJourney.edit.targetDate")}
        </Text>
        <TextInput
          style={styles.input}
          value={editedTargetDate}
          onChangeText={setEditedTargetDate}
          placeholder="DD/MM/YYYY"
        />

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveGrowthSettings}
          disabled={saving}
        >
          <Ionicons name="save-outline" size={18} color={COLORS.white} />
          <Text style={styles.saveButtonText}>
            {saving
              ? t("profile.buttons.saving")
              : t("growthJourney.edit.save")}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface.page,
  },
  content: {
    padding: SPACING[4],
    paddingBottom: SPACING[6],
    gap: SPACING[3],
  },
  headerCard: {
    backgroundColor: COLORS.surface.raised,
    borderRadius: 16,
    padding: SPACING[4],
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  card: {
    backgroundColor: COLORS.surface.raised,
    borderRadius: 16,
    padding: SPACING[4],
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    color: COLORS.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
    marginBottom: 12,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
  },
  rangeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.neutral[300],
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rangeChipActive: {
    borderColor: COLORS.accent.primary,
    backgroundColor: COLORS.accent.soft,
  },
  rangeChipText: {
    color: COLORS.text.secondary,
    fontSize: 12,
    fontWeight: "600",
  },
  rangeChipTextActive: {
    color: COLORS.accent.strong,
  },
  navigationRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  navButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.neutral[300],
    borderRadius: 10,
    paddingVertical: 8,
    gap: 6,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    color: COLORS.text.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  jumpButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.neutral[100],
  },
  jumpButtonText: {
    color: COLORS.text.secondary,
    fontSize: 12,
    fontWeight: "600",
  },
  legendRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: "600",
  },
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    minHeight: 160,
    gap: 4,
  },
  weekColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  barsWrap: {
    width: "100%",
    height: 126,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
    borderRadius: 6,
  },
  barsWrapSelected: {
    backgroundColor: COLORS.neutral[100],
  },
  bar: {
    width: 6,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  xAxisRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
  },
  xAxisLabelSlot: {
    flex: 1,
    alignItems: "center",
    minHeight: 14,
  },
  xAxisLabelText: {
    fontSize: 10,
    color: COLORS.text.secondary,
  },
  emptyText: {
    color: COLORS.text.secondary,
    fontSize: 13,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  summaryLabel: {
    color: COLORS.text.secondary,
    fontSize: 11,
    fontWeight: "600",
  },
  summaryValue: {
    marginTop: 4,
    color: COLORS.text.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  selectedWeekCard: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
    padding: 10,
  },
  selectedWeekTitle: {
    fontSize: 13,
    color: COLORS.text.primary,
    fontWeight: "700",
    marginBottom: 6,
  },
  selectedWeekLine: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  editHint: {
    color: COLORS.text.secondary,
    fontSize: 13,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.neutral[300],
    paddingHorizontal: 12,
    marginBottom: 10,
    color: COLORS.text.primary,
    backgroundColor: COLORS.white,
  },
  saveButton: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: COLORS.accent.primary,
    paddingVertical: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
