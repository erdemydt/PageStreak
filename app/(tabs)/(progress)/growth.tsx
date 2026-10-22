import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import GoalSheet from "../../../components/progress/GoalSheet";
import Button from "../../../components/ui/Button";
import Chip from "../../../components/ui/Chip";
import Eyebrow from "../../../components/ui/Eyebrow";
import Screen from "../../../components/ui/Screen";
import StatRow from "../../../components/ui/StatRow";
import { getUserPreferences } from "../../../db/repos/preferences";
import {
  getFirstSessionDate,
  listSessionMinutes,
} from "../../../db/repos/sessions";
import { useFocusRefresh } from "../../../hooks/useFocusRefresh";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { FONTS, TYPE } from "../../../themes/typography";
import type { UserPreferences } from "../../../types/models";
import { parseDbDate, parseLocalDateString } from "../../../utils/dateUtils";
import { formatDate, formatDuration, LONG_DATE } from "../../../utils/format";
import { loadGoalForDate } from "../../../utils/goalHistory";
import { planState } from "../../../utils/goalSettings";

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

const diffWeeks = (laterDate: Date, earlierDate: Date) =>
  Math.floor((laterDate.getTime() - earlierDate.getTime()) / MS_PER_WEEK);

const getTimelineStartDate = (
  createdAt?: string,
  firstReadingDate?: string | null,
) => {
  if (firstReadingDate) {
    return parseLocalDateString(firstReadingDate);
  }

  const created = parseDbDate(createdAt);
  if (created) {
    return created;
  }

  return new Date();
};

/**
 * Growth Journey: each week's reading against that week's goals, and the one
 * place to change the daily goal plan (GoalSheet).
 */
export default function GrowthScreen() {
  const { t } = useTranslation();
  const [weeklyData, setWeeklyData] = useState<WeeklyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [rangeWeeks, setRangeWeeks] =
    useState<(typeof RANGE_OPTIONS)[number]>(12);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>("");
  const [timelineStartWeek, setTimelineStartWeek] = useState<Date | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [editing, setEditing] = useState(false);

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

      const userPrefs = await getUserPreferences();
      const firstReadingDate = await getFirstSessionDate();

      const derivedTimelineStart = getWeekStart(
        getTimelineStartDate(userPrefs?.created_at, firstReadingDate),
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

      const rows = await listSessionMinutes(startDateKey, endDateKey);

      const actualByWeek = new Map<string, number>();
      for (const row of rows) {
        const sessionDate = parseLocalDateString(row.date);
        const sessionWeek = getWeekStart(sessionDate);
        const weekKey = toDateKey(sessionWeek);
        actualByWeek.set(
          weekKey,
          (actualByWeek.get(weekKey) || 0) + row.minutes_read,
        );
      }

      const goalForDate = await loadGoalForDate();

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
        // The week's target is the sum of each day's goal as it was then
        let targetMinutes = 0;
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const day = new Date(weekStart);
          day.setDate(day.getDate() + dayOffset);
          targetMinutes += goalForDate(toDateKey(day));
        }

        return {
          key: weekKey,
          weekStart,
          targetMinutes,
          actualMinutes: actualByWeek.get(weekKey) || 0,
          applicable: true,
        } as WeeklyPoint;
      });

      setWeeklyData(points);
      setPrefs(userPrefs);

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
  }, [t, weekWindow.endWeekStart, weekWindow.startWeekStart]);

  useFocusRefresh(
    loadGrowthData,
    ["sessions", "preferences"],
    [loadGrowthData],
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


  const dailyGoal = prefs?.current_reading_rate_minutes_per_day || 0;
  const targetGoal = prefs?.end_reading_rate_goal_minutes_per_day || dailyGoal;
  const weeklyIncrease = prefs?.weekly_reading_rate_increase_minutes || 0;
  const goalDate = prefs?.end_reading_rate_goal_date;
  const plan = planState(prefs);
  const applicableWeeks = weeklyData.filter((point) => point.applicable).length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.plan}>
          <Eyebrow>{t("growthJourney.plan")}</Eyebrow>
          <Text style={styles.planValue}>
            {t("progress.minutesPerDay", { count: dailyGoal })}
          </Text>
          <Text style={styles.meta}>
            {plan === "ended"
              ? t("progress.planEnded", { date: formatDate(goalDate, LONG_DATE) })
              : plan === "growing"
              ? goalDate
                ? t("growthJourney.planGrowing", {
                    increase: weeklyIncrease,
                    target: targetGoal,
                    date: formatDate(goalDate, LONG_DATE),
                  })
                : t("progress.growingToNoDate", { target: targetGoal })
              : t("progress.atTarget")}
          </Text>
          <Button
            title={t("growthJourney.edit.title")}
            variant="secondary"
            icon="create-outline"
            onPress={() => setEditing(true)}
            style={styles.editButton}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.rangeRow}>
            {RANGE_OPTIONS.map((range) => (
              <Chip
                key={range}
                label={t("growthJourney.controls.weeks", { count: range })}
                selected={rangeWeeks === range}
                onPress={() => onRangeChange(range)}
                grow
              />
            ))}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.targetBar]} />
              <Text style={styles.meta}>{t("growthJourney.chart.target")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.actualBar]} />
              <Text style={styles.meta}>{t("growthJourney.chart.actual")}</Text>
            </View>
          </View>

          {loading && weeklyData.length === 0 ? (
            <Text style={styles.meta}>{t("growthJourney.loading")}</Text>
          ) : (
            <>
              <View style={styles.chartRow}>
                {weeklyData.map((point) => {
                  const targetHeight = Math.max(
                    2,
                    (point.targetMinutes / maxChartValue) * CHART_HEIGHT,
                  );
                  const actualHeight = Math.max(
                    2,
                    (point.actualMinutes / maxChartValue) * CHART_HEIGHT,
                  );
                  const isSelected = selectedWeekKey === point.key;
                  return (
                    <Pressable
                      key={point.key}
                      style={styles.weekColumn}
                      onPress={() => setSelectedWeekKey(point.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={t("growthJourney.weekA11y", {
                        date: formatWeekLabel(point.weekStart),
                        actual: Math.round(point.actualMinutes),
                        target: Math.round(point.targetMinutes),
                      })}
                    >
                      <View
                        style={[styles.barsWrap, isSelected && styles.barsSelected]}
                      >
                        <View
                          style={[styles.bar, styles.targetBar, { height: targetHeight }]}
                        />
                        <View
                          style={[
                            styles.bar,
                            point.actualMinutes >= point.targetMinutes
                              ? styles.actualBar
                              : styles.actualShortBar,
                            { height: actualHeight },
                          ]}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.xAxisRow}>
                {weeklyData.map((point, index) => {
                  const showLabel =
                    index % xAxisLabelStep === 0 || index === weeklyData.length - 1;
                  return (
                    <View key={`${point.key}-label`} style={styles.xAxisLabelSlot}>
                      <Text style={styles.xAxisLabel}>
                        {showLabel ? formatWeekLabel(point.weekStart) : ""}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.navigationRow}>
            <Pressable
              onPress={() =>
                setOffsetWeeks((prev) => Math.min(maxOffsetWeeks, prev + 1))
              }
              disabled={offsetWeeks >= maxOffsetWeeks}
              accessibilityRole="button"
              accessibilityLabel={t("growthJourney.controls.prev")}
              hitSlop={10}
              style={[styles.navButton, offsetWeeks >= maxOffsetWeeks && styles.disabled]}
            >
              <Ionicons name="chevron-back" size={20} color={COLORS.ink.primary} />
            </Pressable>
            <Pressable
              onPress={() => setOffsetWeeks(0)}
              disabled={offsetWeeks === 0}
              accessibilityRole="button"
              style={styles.navCenter}
            >
              <Text style={[styles.meta, offsetWeeks === 0 && styles.disabled]}>
                {t("growthJourney.controls.current")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOffsetWeeks((prev) => Math.max(0, prev - 1))}
              disabled={offsetWeeks === 0}
              accessibilityRole="button"
              accessibilityLabel={t("growthJourney.controls.next")}
              hitSlop={10}
              style={[styles.navButton, offsetWeeks === 0 && styles.disabled]}
            >
              <Ionicons name="chevron-forward" size={20} color={COLORS.ink.primary} />
            </Pressable>
          </View>
        </View>

        {selectedWeek && (
          <View style={styles.section}>
            <Eyebrow>
              {t("growthJourney.summary.weekOf", {
                date: formatWeekLabel(selectedWeek.weekStart),
              })}
            </Eyebrow>
            <StatRow
              stats={[
                {
                  label: t("growthJourney.chart.actual"),
                  value: formatDuration(Math.round(selectedWeek.actualMinutes)),
                },
                {
                  label: t("growthJourney.chart.target"),
                  value: formatDuration(Math.round(selectedWeek.targetMinutes)),
                },
              ]}
            />
          </View>
        )}

        <View style={styles.section}>
          <Eyebrow>{t("growthJourney.summary.title")}</Eyebrow>
          <StatRow
            stats={[
              {
                label: t("growthJourney.summary.goalHit"),
                value: `${goalHitWeeks}/${applicableWeeks}`,
              },
              {
                label: t("growthJourney.summary.avgVariance"),
                value: `${averageVariance >= 0 ? "+" : ""}${averageVariance}`,
              },
              {
                label: t("growthJourney.summary.trend"),
                value:
                  trendDirection === "up"
                    ? t("growthJourney.summary.trendUp")
                    : trendDirection === "down"
                      ? t("growthJourney.summary.trendDown")
                      : t("growthJourney.summary.trendFlat"),
              },
            ]}
          />
        </View>
      </ScrollView>

      <GoalSheet visible={editing} prefs={prefs} onClose={() => setEditing(false)} />
    </Screen>
  );
}

const CHART_HEIGHT = 140;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[3],
    paddingBottom: SPACING[8],
    gap: SPACING[6],
  },
  plan: {
    gap: SPACING[2],
  },
  planValue: {
    ...TYPE.title,
  },
  meta: TYPE.meta,
  editButton: {
    alignSelf: "flex-start",
    marginTop: SPACING[2],
  },
  section: {
    gap: SPACING[3],
  },
  rangeRow: {
    flexDirection: "row",
    gap: SPACING[2],
  },
  legendRow: {
    flexDirection: "row",
    gap: SPACING[4],
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: CHART_HEIGHT + 8,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: COLORS.line.strong,
  },
  weekColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  barsWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
    paddingTop: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barsSelected: {
    backgroundColor: COLORS.paper.sunken,
  },
  bar: {
    width: 5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  targetBar: {
    backgroundColor: COLORS.line.strong,
  },
  actualBar: {
    backgroundColor: COLORS.accent.primary,
  },
  actualShortBar: {
    backgroundColor: COLORS.ink.tertiary,
  },
  xAxisRow: {
    flexDirection: "row",
    gap: 2,
  },
  xAxisLabelSlot: {
    flex: 1,
    alignItems: "center",
    overflow: "visible",
  },
  xAxisLabel: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: COLORS.ink.tertiary,
    width: 40,
    textAlign: "center",
  },
  navigationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  navCenter: {
    flex: 1,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.3,
  },
});
