import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import WeekStrip from "../../../components/today/WeekStrip";
import Eyebrow from "../../../components/ui/Eyebrow";
import FieldSheet from "../../../components/ui/FieldSheet";
import Hairline from "../../../components/ui/Hairline";
import ProgressRule from "../../../components/ui/ProgressRule";
import Screen from "../../../components/ui/Screen";
import StatRow from "../../../components/ui/StatRow";
import { listBooksWithStats } from "../../../db/repos/books";
import {
  getUserPreferences,
  setYearlyBookGoal,
} from "../../../db/repos/preferences";
import {
  getDailyTotals,
  listSessionsWithBooks,
} from "../../../db/repos/sessions";
import { useFocusRefresh } from "../../../hooks/useFocusRefresh";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { FONTS, TYPE } from "../../../themes/typography";
import type { UserPreferences } from "../../../types/models";
import { getTodayDateString, parseDbDate } from "../../../utils/dateUtils";
import { formatDate, formatDuration, LONG_DATE } from "../../../utils/format";
import { planState } from "../../../utils/goalSettings";
import { loadGoalForDate } from "../../../utils/goalHistory";
import { calculateStreaks } from "../../../utils/readingProgress";
import { loadWeek, WeekDay } from "../../../utils/week";

type TopBook = { name: string; minutes: number };

/**
 * How it's going: the streak and this week, the daily-goal plan (→ Growth),
 * the year in books, and the way into the full history.
 */
export default function ProgressScreen() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [week, setWeek] = useState<WeekDay[]>([]);
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const [topBook, setTopBook] = useState<TopBook | null>(null);
  const [finishedThisYear, setFinishedThisYear] = useState(0);
  const [editingYearly, setEditingYearly] = useState(false);

  const load = async () => {
    const today = getTodayDateString();
    const orFallback = <T,>(promise: Promise<T>, fallback: T) =>
      promise.catch((error) => {
        console.error("Failed to load part of Progress:", error);
        return fallback;
      });
    const weekDays = await orFallback(loadWeek(today), []);
    const [user, totals, goalForDate, sessions, read] = await Promise.all([
      orFallback(getUserPreferences(), null),
      orFallback(getDailyTotals(), []),
      orFallback(loadGoalForDate(), null),
      weekDays.length === 7
        ? orFallback(listSessionsWithBooks(weekDays[0].date, weekDays[6].date), [])
        : Promise.resolve([]),
      orFallback(listBooksWithStats({ status: "read" }), []),
    ]);

    setPrefs(user);
    setWeek(weekDays);
    setStreak(
      goalForDate
        ? calculateStreaks(totals, goalForDate, today)
        : { currentStreak: 0, longestStreak: 0 },
    );

    // By book id: two books can share a title
    const byBook = new Map<number, TopBook>();
    sessions.forEach((s) => {
      const entry = byBook.get(s.book_id) ?? { name: s.book_name, minutes: 0 };
      entry.minutes += s.minutes_read;
      byBook.set(s.book_id, entry);
    });
    setTopBook(
      [...byBook.values()].sort((a, b) => b.minutes - a.minutes)[0] ?? null,
    );

    const year = new Date().getFullYear();
    setFinishedThisYear(
      read.filter((b) => parseDbDate(b.date_finished)?.getFullYear() === year)
        .length,
    );
  };
  useFocusRefresh(load, ["sessions", "books", "preferences"]);

  // This week so far, from the user's first day. Today counts toward "days met"
  // and "per day" only once it's met, so the week doesn't start at 0/1 every
  // Monday morning and a half-read today doesn't drag the average down
  const elapsed = week.filter((d) => d.state !== "upcoming" && d.state !== "before");
  const judged = elapsed.filter((d) => d.state !== "today" || d.metToday);
  const weekMinutes = elapsed.reduce((sum, d) => sum + d.minutes, 0);
  const daysMet = judged.filter((d) => d.state === "met" || d.metToday).length;
  const judgedMinutes = judged.reduce((sum, d) => sum + d.minutes, 0);
  const average = judged.length ? Math.round(judgedMinutes / judged.length) : 0;

  const dailyGoal = prefs?.current_reading_rate_minutes_per_day || 0;
  const startGoal = prefs?.initial_reading_rate_minutes_per_day || dailyGoal;
  const targetGoal = prefs?.end_reading_rate_goal_minutes_per_day || dailyGoal;
  const goalDate = prefs?.end_reading_rate_goal_date;
  const plan = planState(prefs);
  const growing = plan === "growing";
  const growthProgress =
    targetGoal > startGoal ? (dailyGoal - startGoal) / (targetGoal - startGoal) : 1;

  const yearlyGoal = prefs?.yearly_book_goal || 0;
  const year = new Date().getFullYear();

  const saveYearly = async (value: string) => {
    const goal = Number(value.trim() || "0");
    if (!Number.isInteger(goal) || goal < 0 || goal > 999) {
      return t("progress.yearlyInvalid");
    }
    await setYearlyBookGoal(goal);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.streakBlock}>
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={28} color={COLORS.streak.fill} />
            <Text style={styles.streakNumber}>{streak.currentStreak}</Text>
          </View>
          <Text style={styles.streakLabel}>
            {streak.currentStreak === 1
              ? t("progress.streakOne")
              : t("progress.streakOther")}
            {streak.longestStreak > streak.currentStreak
              ? ` · ${t("progress.longest", { count: streak.longestStreak })}`
              : ""}
          </Text>
        </View>

        {week.length === 7 && (
          <WeekStrip days={week} onPress={() => router.push("/history")} />
        )}

        <StatRow
          style={styles.stats}
          stats={[
            { label: t("progress.thisWeek"), value: formatDuration(weekMinutes) },
            {
              label: t("progress.daysMet"),
              value: `${daysMet}/${judged.length}`,
            },
            { label: t("progress.perDay"), value: formatDuration(average) },
          ]}
        />
        {topBook && (
          <Text style={styles.meta}>
            {t("progress.mostRead", {
              title: topBook.name,
              time: formatDuration(topBook.minutes),
            })}
          </Text>
        )}

        <View style={styles.section}>
          <Eyebrow>{t("progress.dailyGoal")}</Eyebrow>
          <Pressable
            onPress={() => router.push("/growth")}
            accessibilityRole="button"
            accessibilityHint={t("progress.openGrowth")}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cardValue}>
                {t("progress.minutesPerDay", { count: dailyGoal })}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.ink.tertiary}
              />
            </View>
            <Text style={styles.meta}>
              {plan === "ended"
                ? t("progress.planEnded", { date: formatDate(goalDate, LONG_DATE) })
                : growing && goalDate
                  ? t("progress.growingTo", {
                      target: targetGoal,
                      date: formatDate(goalDate, LONG_DATE),
                    })
                  : growing
                    ? t("progress.growingToNoDate", { target: targetGoal })
                    : t("progress.atTarget")}
            </Text>
            {growing && (
              <ProgressRule progress={growthProgress} style={styles.rule} />
            )}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Eyebrow>{t("progress.year", { year })}</Eyebrow>
          <Pressable
            onPress={() => setEditingYearly(true)}
            accessibilityRole="button"
            accessibilityHint={t("progress.editYearly")}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cardValue}>
                {yearlyGoal > 0
                  ? t("progress.booksOfGoal", {
                      count: finishedThisYear,
                      goal: yearlyGoal,
                    })
                  : finishedThisYear === 1
                    ? t("progress.booksFinishedOne")
                    : t("progress.booksFinished", { count: finishedThisYear })}
              </Text>
              <Text style={styles.link}>
                {yearlyGoal > 0 ? t("progress.edit") : t("progress.setGoal")}
              </Text>
            </View>
            {yearlyGoal > 0 ? (
              <ProgressRule
                progress={finishedThisYear / yearlyGoal}
                color={COLORS.ink.primary}
                style={styles.rule}
              />
            ) : (
              <Text style={styles.meta}>{t("progress.yearlyHint")}</Text>
            )}
          </Pressable>
        </View>

        <Hairline />
        <Pressable
          onPress={() => router.push("/history")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
        >
          <Ionicons name="time-outline" size={20} color={COLORS.ink.primary} />
          <Text style={styles.historyLabel}>{t("progress.history")}</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.ink.tertiary} />
        </Pressable>
        <Hairline />
      </ScrollView>

      <FieldSheet
        visible={editingYearly}
        title={t("progress.yearlyTitle", { year })}
        hint={t("progress.yearlySheetHint")}
        initialValue={yearlyGoal > 0 ? String(yearlyGoal) : ""}
        keyboardType="number-pad"
        maxLength={3}
        large
        onSave={saveYearly}
        onClose={() => setEditingYearly(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[3],
    paddingBottom: SPACING[8],
    gap: SPACING[4],
  },
  streakBlock: {
    gap: SPACING[1],
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
  },
  streakNumber: {
    ...TYPE.numeral,
  },
  streakLabel: TYPE.byline,
  stats: {
    marginTop: SPACING[1],
  },
  meta: TYPE.meta,
  section: {
    gap: SPACING[2],
    marginTop: SPACING[3],
  },
  card: {
    gap: SPACING[2],
    paddingVertical: SPACING[3],
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
  },
  pressed: {
    opacity: 0.6,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING[3],
  },
  cardValue: {
    flex: 1,
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 28,
    color: COLORS.ink.primary,
  },
  link: {
    ...TYPE.label,
    color: COLORS.accent.primary,
  },
  rule: {
    marginTop: SPACING[1],
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
    minHeight: 56,
  },
  historyLabel: {
    ...TYPE.label,
    flex: 1,
  },
});
