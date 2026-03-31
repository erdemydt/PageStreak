import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { execute, queryAll, ReadingSession } from "../db/db";
import { dateToLocalDateString, getTodayDateString } from "../utils/dateUtils";
import { syncBookCurrentPageFromSessions } from "../utils/readingProgress";

export type SessionWithBook = ReadingSession & {
  book_name: string;
  book_author: string;
};

export type WeekDay = {
  date: string;
  day: string;
  dayNum: number;
  isToday: boolean;
  sessions: SessionWithBook[];
  totalMinutes: number;
};

export const useReadingSessions = () => {
  const { t } = useTranslation();

  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] =
    useState<SessionWithBook | null>(null);
  const [isWeeklyView, setIsWeeklyView] = useState(false);

  const getLocalizedWeekday = useCallback(
    (date: Date): string => {
      const dayIndex = date.getDay();
      const mondayFirstIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      return t(`components.readingLogs.weekdays.${weekdays[mondayFirstIndex]}`);
    },
    [t],
  );

  const getLocalizedMonth = useCallback(
    (monthIndex: number): string => {
      const months = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ];
      return t(`components.readingLogs.months.${months[monthIndex]}`);
    },
    [t],
  );

  const getWeekStart = useCallback((date: Date) => {
    const normalizedDate = new Date(date);
    const day = normalizedDate.getDay();
    const diff = day === 0 ? -6 : -(day - 1);

    return new Date(normalizedDate.setDate(normalizedDate.getDate() + diff));
  }, []);

  const getWeekDates = useCallback(
    (startDate: Date): WeekDay[] => {
      const dates: WeekDay[] = [];
      const today = getTodayDateString();

      for (let index = 0; index < 7; index++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + index);
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
    },
    [getLocalizedWeekday],
  );

  const loadWeekData = useCallback(async () => {
    try {
      const weekStart = getWeekStart(currentWeekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const startDateString = dateToLocalDateString(weekStart);
      const endDateString = dateToLocalDateString(weekEnd);

      const sessions = await queryAll<SessionWithBook>(
        `
        SELECT rs.*, eb.name as book_name, eb.author as book_author
        FROM reading_sessions rs
        JOIN enhanced_books eb ON rs.book_id = eb.id
        WHERE rs.date BETWEEN ? AND ?
        ORDER BY rs.date, rs.created_at
      `,
        [startDateString, endDateString],
      );

      const weekDates = getWeekDates(weekStart);

      const sessionsByDate = sessions.reduce(
        (accumulator, session) => {
          if (!accumulator[session.date]) {
            accumulator[session.date] = [];
          }
          accumulator[session.date].push(session);
          return accumulator;
        },
        {} as Record<string, SessionWithBook[]>,
      );

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
  }, [currentWeekStart, getWeekDates, getWeekStart, t]);

  const navigateWeek = useCallback((direction: "prev" | "next") => {
    setCurrentWeekStart((previousDate) => {
      const nextDate = new Date(previousDate);
      nextDate.setDate(nextDate.getDate() + (direction === "next" ? 7 : -7));
      return nextDate;
    });
  }, []);

  const goToCurrentWeek = useCallback(() => {
    setCurrentWeekStart(new Date());
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWeekData();
  }, [loadWeekData]);

  const handleEditSession = useCallback((session: SessionWithBook) => {
    setSelectedSession(session);
    setEditModalVisible(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModalVisible(false);
    setSelectedSession(null);
  }, []);

  const handleUpdateSession = useCallback(
    async (
      sessionId: number,
      minutes: number,
      notes: string,
      pages?: number,
    ): Promise<void> => {
      try {
        const sessions = await queryAll<ReadingSession>(
          "SELECT * FROM reading_sessions WHERE id = ?",
          [sessionId],
        );

        if (sessions.length === 0) {
          throw new Error("Session not found");
        }

        const session = sessions[0];

        await execute(
          `UPDATE reading_sessions SET minutes_read = ?, notes = ?, pages_read = ? WHERE id = ?`,
          [minutes, notes || null, pages || null, sessionId],
        );

        if (pages !== undefined) {
          await syncBookCurrentPageFromSessions(session.book_id);
        }

        await loadWeekData();
        Alert.alert(
          t("components.readingLogsEditModal.updateSuccess"),
          t("components.readingLogsEditModal.updateSuccessMessage"),
        );
      } catch (error) {
        console.error("Error updating session:", error);
        throw error;
      }
    },
    [loadWeekData, t],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: number): Promise<void> => {
      try {
        const sessions = await queryAll<ReadingSession>(
          "SELECT * FROM reading_sessions WHERE id = ?",
          [sessionId],
        );

        if (sessions.length === 0) {
          throw new Error("Session not found");
        }

        const session = sessions[0];

        await execute(`DELETE FROM reading_sessions WHERE id = ?`, [sessionId]);

        if (session.pages_read) {
          await syncBookCurrentPageFromSessions(session.book_id);
        }

        await loadWeekData();
        Alert.alert(
          t("components.readingLogsEditModal.deleteSuccess"),
          t("components.readingLogsEditModal.deleteSuccessMessage"),
        );
      } catch (error) {
        console.error("Error deleting session:", error);
        Alert.alert(
          t("components.readingLogsEditModal.deleteError"),
          t("components.readingLogsEditModal.deleteErrorMessage"),
        );
      }
    },
    [loadWeekData, t],
  );

  const formatDate = useCallback(
    (date: Date) => {
      const month = getLocalizedMonth(date.getMonth());
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    },
    [getLocalizedMonth],
  );

  const weekStart = useMemo(
    () => getWeekStart(currentWeekStart),
    [currentWeekStart, getWeekStart],
  );

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);

  const weekTotal = useMemo(
    () => weekData.reduce((sum, day) => sum + day.totalMinutes, 0),
    [weekData],
  );

  return {
    weekData,
    currentWeekStart,
    loading,
    refreshing,
    editModalVisible,
    selectedSession,
    isWeeklyView,
    weekStart,
    weekEnd,
    weekTotal,
    setIsWeeklyView,
    loadWeekData,
    navigateWeek,
    goToCurrentWeek,
    onRefresh,
    handleEditSession,
    closeEditModal,
    handleUpdateSession,
    handleDeleteSession,
    formatDate,
  };
};
