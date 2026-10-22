import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import GoalSheet from "../../../components/progress/GoalSheet";
import Button from "../../../components/ui/Button";
import Chip from "../../../components/ui/Chip";
import Eyebrow from "../../../components/ui/Eyebrow";
import Screen from "../../../components/ui/Screen";
import StatRow from "../../../components/ui/StatRow";
import { getUserPreferences } from "../../../db/repos/preferences";
import { listSessionMinutes } from "../../../db/repos/sessions";
import { useFocusRefresh } from "../../../hooks/useFocusRefresh";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { FONTS, TYPE } from "../../../themes/typography";
import type { UserPreferences } from "../../../types/models";
import {
  addDaysToDateString,
  dateToLocalDateString,
  getTodayDateString,
  parseDbDate,
  parseLocalDateString,
} from "../../../utils/dateUtils";
import { formatDate, formatDuration, LONG_DATE } from "../../../utils/format";
import {
  getTrackingStartDate,
  GoalForDate,
  loadGoalForDate,
} from "../../../utils/goalHistory";
import {
  planState,
  projectDailyGoal,
  projectTargetDate,
} from "../../../utils/goalSettings";
import { getWeekDates } from "../../../utils/week";

type WeekPoint = {
  /** Monday, YYYY-MM-DD */
  key: string;
  /** The week's goal: each judged day's goal, summed */
  goalMinutes: number;
  readMinutes: number;
  /** Starts after this week: only the planned goal is drawn */
  future: boolean;
};

type Loaded = {
  prefs: UserPreferences | null;
  start: string;
  goalForDate: GoalForDate;
  minutesByDate: Map<string, number>;
};

const RANGE_OPTIONS = [4, 12, 24] as const;
/** Full weeks of data before the summary means anything */
const SUMMARY_MIN_WEEKS = 3;
const SHORT_DAY_MONTH: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

const weekLabel = (monday: string) =>
  formatDate(parseLocalDateString(monday), SHORT_DAY_MONTH);
const weeksBetween = (later: string, earlier: string) =>
  Math.round(
    (parseLocalDateString(later).getTime() - parseLocalDateString(earlier).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  );

/**
 * Growth Journey: each week's reading against that week's goal, the plan's
 * coming weeks, and the one place to change the plan (GoalSheet).
 */
export default function GrowthScreen() {
  const { t } = useTranslation();
  const [data, setData] = useState<Loaded | null>(null);
  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [rangeWeeks, setRangeWeeks] = useState<(typeof RANGE_OPTIONS)[number]>(12);
  const [selectedKey, setSelectedKey] = useState("");
  const [editing, setEditing] = useState(false);

  const today = getTodayDateString();
  const thisWeek = getWeekDates(today)[0];

  const load = async () => {
    try {
      const [prefs, start, goalForDate, sessions] = await Promise.all([
        getUserPreferences(),
        getTrackingStartDate(),
        loadGoalForDate(),
        listSessionMinutes("0000-01-01", today),
      ]);
      const minutesByDate = new Map<string, number>();
      for (const row of sessions) {
        minutesByDate.set(row.date, (minutesByDate.get(row.date) ?? 0) + row.minutes_read);
      }
      setData({ prefs, start: start ?? today, goalForDate, minutesByDate });
    } catch (error) {
      console.error("Failed to load growth data:", error);
      Alert.alert(t("profile.error.title"), t("profile.error.loadFailed"));
    }
  };
  useFocusRefresh(load, ["sessions", "preferences"]);

  const prefs = data?.prefs ?? null;
  const plan = planState(prefs);
  const firstWeek = data ? getWeekDates(data.start)[0] : thisWeek;
  // Weeks of history, this one included
  const historyWeeks = weeksBetween(thisWeek, firstWeek) + 1;

  // The latest view gives the plan's coming weeks some room (all the room the
  // history doesn't need yet), so it shows only `pastAtLatest` past weeks
  const goalEnd = parseDbDate(prefs?.end_reading_rate_goal_date);
  const weeksToGoalDate =
    plan === "growing" && goalEnd
      ? Math.max(0, weeksBetween(getWeekDates(dateToLocalDateString(goalEnd))[0], thisWeek))
      : 0;
  // A plan that isn't growing gets a few flat planned weeks, not a chart full of them
  const emptyColumns = Math.max(0, rangeWeeks - historyWeeks);
  const reserve = Math.floor(rangeWeeks / 3);
  const futureAtLatest =
    plan === "growing"
      ? Math.max(emptyColumns, Math.min(weeksToGoalDate, reserve))
      : Math.min(emptyColumns, reserve);
  const pastAtLatest = rangeWeeks - futureAtLatest;

  // offset: how many weeks before this one the window ends (0 = the latest view).
  // Paging steps from the oldest week on screen, so no week is ever skipped
  const maxOffset =
    historyWeeks > pastAtLatest ? Math.max(pastAtLatest, historyWeeks - rangeWeeks) : 0;
  const offset = Math.min(offsetWeeks, maxOffset);
  const futureWeeks = offset > 0 ? 0 : futureAtLatest;
  const olderOffset =
    offset === 0 ? Math.min(maxOffset, pastAtLatest) : Math.min(maxOffset, offset + rangeWeeks);
  const newerOffset =
    offset <= pastAtLatest ? 0 : Math.max(offset - rangeWeeks, pastAtLatest);

  const weeks = useMemo<WeekPoint[]>(() => {
    if (!data) return [];
    const lastWeek = addDaysToDateString(thisWeek, 7 * (futureWeeks - offset));
    return Array.from({ length: rangeWeeks }, (_, index) => {
      const key = addDaysToDateString(lastWeek, -7 * (rangeWeeks - 1 - index));
      let goalMinutes = 0;
      let readMinutes = 0;
      for (let day = 0; day < 7; day++) {
        const date = addDaysToDateString(key, day);
        if (date < data.start) continue;
        readMinutes += data.minutesByDate.get(date) ?? 0;
        goalMinutes +=
          date > today
            ? projectDailyGoal(data.prefs, parseLocalDateString(date))
            : data.goalForDate(date);
      }
      return {
        key,
        goalMinutes,
        readMinutes,
        future: key > thisWeek,
      };
    }).filter((week) => addDaysToDateString(week.key, 6) >= firstWeek);
  }, [data, firstWeek, futureWeeks, offset, rangeWeeks, thisWeek, today]);

  const selected =
    weeks.find((week) => week.key === selectedKey) ??
    weeks.find((week) => week.key === thisWeek) ??
    weeks[weeks.length - 1];

  const chartMax = Math.max(
    60,
    ...weeks.map((week) => Math.max(week.goalMinutes, week.readMinutes)),
  );

  // Summary over every full week since the first day, not just the visible ones
  const summary = useMemo(() => {
    if (!data) return null;
    const complete: WeekPoint[] = [];
    // Full weeks only: a first week that began mid-week would skew the trend
    const firstFullWeek =
      firstWeek === data.start ? firstWeek : addDaysToDateString(firstWeek, 7);
    for (let key = firstFullWeek; key < thisWeek; key = addDaysToDateString(key, 7)) {
      let goalMinutes = 0;
      let readMinutes = 0;
      for (let day = 0; day < 7; day++) {
        const date = addDaysToDateString(key, day);
        if (date < data.start) continue;
        readMinutes += data.minutesByDate.get(date) ?? 0;
        goalMinutes += data.goalForDate(date);
      }
      complete.push({ key, goalMinutes, readMinutes, future: false });
    }
    if (complete.length < SUMMARY_MIN_WEEKS) return null;

    const onGoal = complete.filter((w) => w.readMinutes >= w.goalMinutes).length;
    const averageGap = Math.round(
      complete.reduce((sum, w) => sum + w.readMinutes - w.goalMinutes, 0) / complete.length,
    );
    const half = Math.floor(complete.length / 2);
    const mean = (list: WeekPoint[]) =>
      list.reduce((sum, w) => sum + w.readMinutes, 0) / Math.max(1, list.length);
    const change = mean(complete.slice(half)) - mean(complete.slice(0, half));
    const trend = change > 5 ? "up" : change < -5 ? "down" : "flat";
    return { weeks: complete.length, onGoal, averageGap, trend };
  }, [data, firstWeek, thisWeek]);

  const dailyGoal = prefs?.current_reading_rate_minutes_per_day || 0;
  const targetGoal = prefs?.end_reading_rate_goal_minutes_per_day || dailyGoal;
  const weeklyIncrease = prefs?.weekly_reading_rate_increase_minutes || 0;
  const goalDate = prefs?.end_reading_rate_goal_date;
  const labelStep = weeks.length >= 18 ? 4 : weeks.length >= 10 ? 2 : 1;
  // Count label slots from this week when it's in view, so its label never lands beside another.
  const labelAnchor = Math.max(0, weeks.findIndex((week) => week.key === thisWeek));
  const showPlanned = weeks.some((week) => week.future);

  const signedDuration = (minutes: number) =>
    `${minutes > 0 ? "+" : minutes < 0 ? "−" : ""}${formatDuration(Math.abs(minutes))}`;

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
                      date: formatDate(projectTargetDate(prefs) ?? goalDate, LONG_DATE),
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
          <Eyebrow>{t("growthJourney.chart.title")}</Eyebrow>
          <View style={styles.rangeRow}>
            {RANGE_OPTIONS.map((range) => (
              <Chip
                key={range}
                label={t("growthJourney.controls.weeks", { count: range })}
                selected={rangeWeeks === range}
                onPress={() => {
                  setRangeWeeks(range);
                  setOffsetWeeks(0);
                }}
                grow
              />
            ))}
          </View>

          {!data ? (
            <Text style={styles.meta}>{t("growthJourney.loading")}</Text>
          ) : (
            <>
              <View style={styles.chartRow}>
                {weeks.map((week) => {
                  const goalHeight = Math.max(2, (week.goalMinutes / chartMax) * CHART_HEIGHT);
                  const readHeight = (week.readMinutes / chartMax) * CHART_HEIGHT;
                  const isSelected = selected?.key === week.key;
                  return (
                    <Pressable
                      key={week.key}
                      style={styles.weekColumn}
                      onPress={() => setSelectedKey(week.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={
                        week.future
                          ? t("growthJourney.weekPlannedA11y", {
                              date: weekLabel(week.key),
                              target: Math.round(week.goalMinutes),
                            })
                          : t("growthJourney.weekA11y", {
                              date: weekLabel(week.key),
                              actual: Math.round(week.readMinutes),
                              target: Math.round(week.goalMinutes),
                            })
                      }
                    >
                      <View style={[styles.barsWrap, isSelected && styles.barsSelected]}>
                        <View
                          style={[
                            styles.bar,
                            week.future ? styles.plannedBar : styles.goalBar,
                            { height: goalHeight },
                          ]}
                        />
                        {!week.future && (
                          <View
                            style={[
                              styles.bar,
                              styles.readBar,
                              { height: Math.max(readHeight > 0 ? 2 : 0, readHeight) },
                            ]}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.axisRow}>
                {weeks.map((week, index) => (
                  <View key={week.key} style={styles.axisSlot}>
                    <Text style={[styles.axisLabel, week.key === thisWeek && styles.axisNow]}>
                      {(index - labelAnchor) % labelStep === 0
                        ? weekLabel(week.key)
                        : ""}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.legendRow}>
                <Legend swatch={styles.readBar} label={t("growthJourney.chart.actual")} />
                <Legend swatch={styles.goalBar} label={t("growthJourney.chart.target")} />
                {showPlanned && (
                  <Legend swatch={styles.plannedBar} label={t("growthJourney.chart.planned")} />
                )}
              </View>

              {maxOffset > 0 && (
                <View style={styles.navigationRow}>
                  <Pressable
                    onPress={() => setOffsetWeeks(olderOffset)}
                    disabled={offset >= maxOffset}
                    accessibilityRole="button"
                    accessibilityLabel={t("growthJourney.controls.prev")}
                    hitSlop={10}
                    style={[styles.navButton, offset >= maxOffset && styles.disabled]}
                  >
                    <Ionicons name="chevron-back" size={20} color={COLORS.ink.primary} />
                  </Pressable>
                  <View style={styles.navCenter}>
                    {offset > 0 && (
                      <Pressable
                        onPress={() => setOffsetWeeks(0)}
                        accessibilityRole="button"
                        hitSlop={8}
                      >
                        <Text style={styles.link}>{t("growthJourney.controls.current")}</Text>
                      </Pressable>
                    )}
                  </View>
                  <Pressable
                    onPress={() => setOffsetWeeks(newerOffset)}
                    disabled={offset === 0}
                    accessibilityRole="button"
                    accessibilityLabel={t("growthJourney.controls.next")}
                    hitSlop={10}
                    style={[styles.navButton, offset === 0 && styles.disabled]}
                  >
                    <Ionicons name="chevron-forward" size={20} color={COLORS.ink.primary} />
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

        {selected && (
          <View style={styles.section}>
            <Eyebrow>{t("growthJourney.summary.weekOf", { date: weekLabel(selected.key) })}</Eyebrow>
            <StatRow
              stats={
                selected.future
                  ? [
                      {
                        label: t("growthJourney.chart.planned"),
                        value: formatDuration(selected.goalMinutes),
                      },
                    ]
                  : [
                      {
                        label: t("growthJourney.chart.actual"),
                        value: formatDuration(selected.readMinutes),
                      },
                      {
                        label: t("growthJourney.chart.target"),
                        value: formatDuration(selected.goalMinutes),
                      },
                    ]
              }
            />
          </View>
        )}

        {data && (
          <View style={styles.section}>
            <Eyebrow>{t("growthJourney.summary.title")}</Eyebrow>
            {summary ? (
              <StatRow
                stats={[
                  {
                    label: t("growthJourney.summary.goalHit"),
                    value: `${summary.onGoal}/${summary.weeks}`,
                  },
                  {
                    label: t("growthJourney.summary.avgVariance"),
                    value: signedDuration(summary.averageGap),
                  },
                  {
                    label: t("growthJourney.summary.trend"),
                    value:
                      summary.trend === "up"
                        ? t("growthJourney.summary.trendUp")
                        : summary.trend === "down"
                          ? t("growthJourney.summary.trendDown")
                          : t("growthJourney.summary.trendFlat"),
                  },
                ]}
              />
            ) : (
              <Text style={styles.meta}>
                {t("growthJourney.summary.notYet", { count: SUMMARY_MIN_WEEKS })}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <GoalSheet visible={editing} prefs={prefs} onClose={() => setEditing(false)} />
    </Screen>
  );
}

function Legend({ swatch, label }: { swatch: StyleProp<ViewStyle>; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, swatch]} />
      <Text style={styles.meta}>{label}</Text>
    </View>
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
  link: {
    ...TYPE.meta,
    fontFamily: FONTS.sansSemiBold,
    color: COLORS.accent.primary,
  },
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
    flexWrap: "wrap",
    columnGap: SPACING[4],
    rowGap: SPACING[1],
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
    width: "30%",
    maxWidth: 12,
    minWidth: 4,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  goalBar: {
    backgroundColor: COLORS.line.strong,
  },
  readBar: {
    backgroundColor: COLORS.accent.primary,
  },
  plannedBar: {
    borderWidth: 1,
    borderColor: COLORS.line.strong,
    borderStyle: "dashed",
  },
  axisRow: {
    flexDirection: "row",
    gap: 2,
  },
  axisSlot: {
    flex: 1,
    alignItems: "center",
    overflow: "visible",
  },
  axisLabel: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: COLORS.ink.tertiary,
    width: 44,
    textAlign: "center",
  },
  axisNow: {
    fontFamily: FONTS.sansSemiBold,
    color: COLORS.ink.primary,
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
