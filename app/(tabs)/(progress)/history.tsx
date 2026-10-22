import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import SessionRow from "../../../components/session/SessionRow";
import Button from "../../../components/ui/Button";
import Hairline from "../../../components/ui/Hairline";
import Screen from "../../../components/ui/Screen";
import { useSessionSheets } from "../../../contexts/SessionSheetsContext";
import {
  listSessionsWithBooks,
  SessionWithBook,
} from "../../../db/repos/sessions";
import { useFocusRefresh } from "../../../hooks/useFocusRefresh";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { FONTS, TYPE } from "../../../themes/typography";
import {
  addDaysToDateString,
  getTodayDateString,
  parseLocalDateString,
} from "../../../utils/dateUtils";
import { generateRandomReadingData } from "../../../utils/devData";
import { isDevModeEnabled } from "../../../utils/devMode";
import {
  formatDate,
  formatDuration,
  formatSessionDetail,
} from "../../../utils/format";
import { formatWeekday, getWeekDates } from "../../../utils/week";

const DAY_LABEL: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };

/**
 * Every session, a week at a time (Monday first). Tap a session to fix it;
 * "+" logs one on that day. Opened from Progress and from Today's week strip.
 */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const { editSession, openLogger } = useSessionSheets();
  const today = getTodayDateString();
  // Any date in the week being shown
  const [anchor, setAnchor] = useState(today);
  const [sessions, setSessions] = useState<SessionWithBook[]>([]);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dates = getWeekDates(anchor);
  const isCurrentWeek = dates.includes(today);

  const load = async () => {
    try {
      setSessions(await listSessionsWithBooks(dates[0], dates[6]));
      setFailed(false);
    } catch (error) {
      console.error("Error loading history:", error);
      setFailed(true);
    }
  };
  useFocusRefresh(load, ["sessions", "books"], [anchor]);

  // Only the shown week: right after a week change, `sessions` still holds the
  // previous week until the load finishes
  const weekSessions = sessions.filter(
    (s) => s.date >= dates[0] && s.date <= dates[6],
  );
  const byDate = new Map<string, SessionWithBook[]>();
  weekSessions.forEach((s) =>
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]),
  );
  const weekTotal = weekSessions.reduce((sum, s) => sum + s.minutes_read, 0);

  // Newest day first; days after today aren't shown
  const days = [...dates].reverse().filter((date) => date <= today);
  const rangeLabel = `${formatDate(dates[0], DAY_LABEL)} – ${formatDate(dates[6], DAY_LABEL)}`;

  return (
    <Screen>
      <View style={styles.weekBar}>
        <Pressable
          onPress={() => setAnchor(addDaysToDateString(anchor, -7))}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.previousWeek")}
          hitSlop={12}
          style={styles.navButton}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.ink.primary} />
        </Pressable>
        <Pressable
          onPress={() => setAnchor(today)}
          disabled={isCurrentWeek}
          accessibilityRole="button"
          accessibilityState={{ disabled: isCurrentWeek }}
          accessibilityHint={isCurrentWeek ? undefined : t("history.backToThisWeek")}
          style={styles.weekInfo}
        >
          <Text style={styles.weekRange}>{rangeLabel}</Text>
          <Text style={styles.weekTotal}>
            {isCurrentWeek
              ? t("history.thisWeekTotal", { time: formatDuration(weekTotal) })
              : t("history.weekTotal", { time: formatDuration(weekTotal) })}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setAnchor(addDaysToDateString(anchor, 7))}
          disabled={isCurrentWeek}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.nextWeek")}
          accessibilityState={{ disabled: isCurrentWeek }}
          hitSlop={12}
          style={[styles.navButton, isCurrentWeek && styles.disabled]}
        >
          <Ionicons name="chevron-forward" size={22} color={COLORS.ink.primary} />
        </Pressable>
      </View>
      <Hairline />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={COLORS.ink.tertiary}
          />
        }
      >
        {failed && <Text style={styles.error}>{t("components.readingLogs.errorMessage")}</Text>}
        {isDevModeEnabled() && (
          <Button
            title="Generate random data (dev)"
            variant="ghost"
            compact
            onPress={() => {
              generateRandomReadingData().catch((e) => console.error(e));
            }}
          />
        )}

        {days.map((date) => {
          const daySessions = byDate.get(date) ?? [];
          const minutes = daySessions.reduce((sum, s) => sum + s.minutes_read, 0);
          const dayName =
            date === today
              ? t("components.sessionDate.today")
              : date === addDaysToDateString(today, -1)
                ? t("components.sessionDate.yesterday")
                : formatWeekday(date, "long");
          return (
            <View key={date} style={styles.day}>
              <View style={styles.dayHeader}>
                <View style={styles.dayTitle}>
                  <Text style={styles.dayName}>{dayName}</Text>
                  <Text style={styles.dayDate}>
                    {formatDate(parseLocalDateString(date), DAY_LABEL)}
                    {minutes > 0 ? ` · ${formatDuration(minutes)}` : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() => openLogger({ date })}
                  accessibilityRole="button"
                  accessibilityLabel={t("history.addSession", { day: dayName })}
                  hitSlop={10}
                  style={({ pressed }) => [styles.add, pressed && styles.pressed]}
                >
                  <Ionicons name="add" size={22} color={COLORS.accent.primary} />
                </Pressable>
              </View>
              {daySessions.length === 0 ? (
                <Text style={styles.empty}>{t("history.noReading")}</Text>
              ) : (
                daySessions.map((session, index) => (
                  <View key={session.id}>
                    {index > 0 && <Hairline />}
                    <SessionRow
                      label={session.book_name}
                      detail={formatSessionDetail(session)}
                      onPress={() => editSession(session)}
                    />
                  </View>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[3],
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.3,
  },
  weekInfo: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  weekRange: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    color: COLORS.ink.primary,
  },
  weekTotal: TYPE.meta,
  content: {
    paddingHorizontal: SPACING[5],
    paddingBottom: SPACING[8],
  },
  error: {
    ...TYPE.meta,
    color: COLORS.destructive.ink,
    paddingTop: SPACING[3],
  },
  day: {
    paddingTop: SPACING[5],
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: SPACING[1],
  },
  dayTitle: {
    flex: 1,
    gap: 2,
  },
  dayName: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    lineHeight: 25,
    color: COLORS.ink.primary,
  },
  dayDate: TYPE.meta,
  add: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  empty: {
    ...TYPE.meta,
    fontFamily: FONTS.serifItalic,
    paddingVertical: SPACING[2],
  },
});
