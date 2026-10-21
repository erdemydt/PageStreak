import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import WeeklyStatsView from "../../../components/WeeklyStatsView";
import { useSessionSheets } from "../../../contexts/SessionSheetsContext";
import {
  listSessionsWithBooks,
  SessionWithBook,
} from "../../../db/repos/sessions";
import { COLORS } from "../../../themes/colors";
import {
  dateToLocalDateString,
  getTodayDateString,
} from "../../../utils/dateUtils";
import { isDevModeEnabled } from "../../../utils/devMode";
import { generateRandomReadingData } from "../../../utils/devData";
import { formatDate, LONG_DATE } from "../../../utils/format";
import { useFocusRefresh } from "../../../hooks/useFocusRefresh";
interface WeekDay {
  date: string;
  day: string;
  dayNum: number;
  isToday: boolean;
  sessions: SessionWithBook[];
  totalMinutes: number;
}

export default function ReadingLogs() {
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { editSession } = useSessionSheets();

  const [isWeeklyView, setIsWeeklyView] = useState(false);

  const { t } = useTranslation();

  const getLocalizedWeekday = (date: Date): string => {
    const dayIndex = date.getDay();
    // Convert JavaScript day index (0=Sunday) to Monday-first array index
    // JS: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    // We want: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const mondayFirstIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    return t(`components.readingLogs.weekdays.${weekdays[mondayFirstIndex]}`);
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    // Calculate days to subtract to get to Monday
    // If day is 0 (Sunday), subtract 6 days to get to Monday
    // If day is 1 (Monday), subtract 0 days
    // If day is 2 (Tuesday), subtract 1 day, etc.
    const diff = day === 0 ? -6 : -(day - 1);
    return new Date(d.setDate(d.getDate() + diff));
  };

  const getWeekDates = (startDate: Date): WeekDay[] => {
    const dates: WeekDay[] = [];
    const today = getTodayDateString();

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateString = dateToLocalDateString(date);

      dates.push({
        date: dateString,
        day: getLocalizedWeekday(date),
        dayNum: date.getDate(),
        isToday: dateString === today,
        sessions: [],
        totalMinutes: 0,
      });
    }
    return dates;
  };

  const loadWeekData = async () => {
    try {
      const weekStart = getWeekStart(currentWeekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const startDateString = dateToLocalDateString(weekStart);
      const endDateString = dateToLocalDateString(weekEnd);

      const sessions = await listSessionsWithBooks(
        startDateString,
        endDateString,
      );

      // Initialize week data
      const weekDates = getWeekDates(weekStart);

      // Group sessions by date
      const sessionsByDate = sessions.reduce(
        (acc, session) => {
          if (!acc[session.date]) {
            acc[session.date] = [];
          }
          acc[session.date].push(session);
          return acc;
        },
        {} as Record<string, SessionWithBook[]>,
      );

      // Add sessions to week data and calculate totals
      weekDates.forEach((day) => {
        day.sessions = sessionsByDate[day.date] || [];
        day.totalMinutes = day.sessions.reduce(
          (sum, session) => sum + session.minutes_read,
          0,
        );
      });

      setWeekData(weekDates);
    } catch (error) {
      console.error("Error loading week data:", error);
      Alert.alert(
        t("components.readingLogs.errorTitle"),
        t("components.readingLogs.errorMessage"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useFocusRefresh(loadWeekData, ["sessions", "books"], [currentWeekStart]);

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(new Date());
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWeekData();
  };

  const handleGenerateRandomData = async () => {
    try {
      await generateRandomReadingData();
    } catch (error) {
      console.error("Error generating random data:", error);
    }
  };

  const weekTotal = weekData.reduce((sum, day) => sum + day.totalMinutes, 0);
  const weekStart = getWeekStart(currentWeekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>
          {t("components.readingLogs.loadingText")}
        </Text>
      </View>
    );
  }

  if (isWeeklyView) {
    return (
      <View style={styles.container}>
        {/* View Mode Toggle */}
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              !isWeeklyView ? styles.toggleButtonActive : undefined,
            ]}
            onPress={() => setIsWeeklyView(false)}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={!isWeeklyView ? COLORS.white : COLORS.neutral[500]}
            />
            <Text
              style={[
                styles.toggleText,
                !isWeeklyView ? styles.toggleTextActive : undefined,
              ]}
            >
              {t("components.readingLogs.dailyView")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              isWeeklyView ? styles.toggleButtonActive : undefined,
            ]}
            onPress={() => setIsWeeklyView(true)}
          >
            <Ionicons
              name="analytics"
              size={16}
              color={isWeeklyView ? COLORS.white : COLORS.neutral[500]}
            />
            <Text
              style={[
                styles.toggleText,
                isWeeklyView ? styles.toggleTextActive : undefined,
              ]}
            >
              {t("components.readingLogs.analytics")}
            </Text>
          </TouchableOpacity>
        </View>

        <WeeklyStatsView
          weekStart={getWeekStart(currentWeekStart)}
          onNavigateWeek={navigateWeek}
          onGoToCurrentWeek={goToCurrentWeek}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* View Mode Toggle */}
      <View style={styles.viewModeToggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            !isWeeklyView ? styles.toggleButtonActive : undefined,
          ]}
          onPress={() => setIsWeeklyView(false)}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={!isWeeklyView ? COLORS.white : COLORS.neutral[500]}
          />
          <Text
            style={[
              styles.toggleText,
              !isWeeklyView ? styles.toggleTextActive : undefined,
            ]}
          >
            {t("components.readingLogs.dailyView")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isWeeklyView ? styles.toggleButtonActive : undefined,
          ]}
          onPress={() => setIsWeeklyView(true)}
        >
          <Ionicons
            name="analytics"
            size={16}
            color={isWeeklyView ? COLORS.white : COLORS.neutral[500]}
          />
          <Text
            style={[
              styles.toggleText,
              isWeeklyView ? styles.toggleTextActive : undefined,
            ]}
          >
            {t("components.readingLogs.analytics")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("a11y.previousWeek")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => navigateWeek("prev")}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goToCurrentWeek} style={styles.weekInfo}>
            <Text style={styles.weekRange}>
              {formatDate(weekStart, LONG_DATE)} -{" "}
              {formatDate(weekEnd, LONG_DATE)}
            </Text>
            <Text style={styles.weekTotal}>
              {weekTotal} {t("components.readingLogs.minutesThisWeek")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("a11y.nextWeek")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => navigateWeek("next")}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Development Only: Random Data Button */}
      {isDevModeEnabled() && (
        <View style={styles.devButtonContainer}>
          <TouchableOpacity
            style={styles.devButton}
            onPress={handleGenerateRandomData}
          >
            <Ionicons name="flask" size={16} color={COLORS.white} />
            <Text style={styles.devButtonText}>
              Generate Random Data (20 sessions)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Week Grid */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.weekGrid}>
          {weekData.map((day) => (
            <View
              key={day.date}
              style={[styles.dayCard, day.isToday && styles.todayCard]}
            >
              {/* Day Header */}
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName, day.isToday && styles.todayText]}>
                  {day.day}
                </Text>
                <Text
                  style={[styles.dayNumber, day.isToday && styles.todayText]}
                >
                  {day.dayNum}
                </Text>
                <Text
                  style={[styles.dayTotal, day.isToday && styles.todayText]}
                >
                  {day.totalMinutes}{" "}
                  {t("components.readingTimeLogger.minutesShort")}
                </Text>
              </View>

              {/* Sessions */}
              <View style={styles.sessionsContainer}>
                {day.sessions.length === 0 ? (
                  <Text style={styles.noSessionsText}>
                    {t("components.readingLogs.noSessionsText")}
                  </Text>
                ) : (
                  day.sessions.map((session) => (
                    <TouchableOpacity
                      key={session.id}
                      style={styles.sessionCard}
                      onPress={() => editSession(session)}
                    >
                      <View style={styles.sessionHeader}>
                        <Text style={styles.sessionTime}>
                          {session.minutes_read}
                          {t("components.readingLogs.minutesSuffix")}
                        </Text>
                        <Text style={styles.editHint}>✏️</Text>
                      </View>
                      <Text style={styles.sessionBook} numberOfLines={2}>
                        {session.book_name}
                      </Text>
                      <Text style={styles.sessionAuthor} numberOfLines={1}>
                        {t("components.readingLogs.sessionCardBy")}{" "}
                        {session.book_author}
                      </Text>
                      {session.notes && (
                        <Text style={styles.sessionNotes} numberOfLines={2}>
                          &ldquo;{session.notes}&rdquo;
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
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
  viewModeToggle: {
    flexDirection: "row",
    backgroundColor: COLORS.neutral[100],
    borderRadius: 8,
    padding: 4,
    margin: 16,
    marginBottom: 0,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[500],
  },
  toggleTextActive: {
    color: COLORS.white,
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
  navButtonText: {
    fontSize: 18,
    color: COLORS.neutral[700],
    fontWeight: "600",
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  weekGrid: {
    paddingVertical: 20,
    gap: 16,
  },
  dayCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  todayCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.state.cardAccent,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[100],
  },
  dayName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[500],
    flex: 1,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.neutral[800],
    flex: 1,
    textAlign: "center",
  },
  dayTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    flex: 1,
    textAlign: "right",
  },
  todayText: {
    color: COLORS.primary,
  },
  sessionsContainer: {
    gap: 8,
  },
  noSessionsText: {
    fontSize: 14,
    color: COLORS.neutral[400],
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
  sessionCard: {
    backgroundColor: COLORS.neutral[50],
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sessionTime: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  editHint: {
    fontSize: 12,
    opacity: 0.6,
  },
  sessionBook: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 2,
  },
  sessionAuthor: {
    fontSize: 12,
    color: COLORS.neutral[500],
    marginBottom: 4,
  },
  sessionNotes: {
    fontSize: 12,
    color: COLORS.neutral[700],
    fontStyle: "italic",
    backgroundColor: COLORS.neutral[100],
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  devButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.neutral[50],
  },
  devButton: {
    backgroundColor: COLORS.info,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  devButtonText: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: "600",
  },
});
