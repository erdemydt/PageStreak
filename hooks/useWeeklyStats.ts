import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { queryAll, queryFirst } from "../db/db";
import { dateToLocalDateString, getTodayDateString } from "../utils/dateUtils";

export interface DailyStats {
  date: string;
  dayName: string;
  minutes: number;
  sessions: number;
  goalMet: boolean;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  streakThisWeek: number;
}

export interface BookStats {
  bookName: string;
  bookAuthor: string;
  minutesRead: number;
  sessionsCount: number;
}

export interface TimeDistribution {
  timeRange: string;
  minutes: number;
  percentage: number;
}

export interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  averageMinutesPerDay: number;
  readingDays: number;
  sessionsCount: number;
  booksRead: string[];
  dailyBreakdown: DailyStats[];
  goalProgress: number;
  streakInfo: StreakInfo;
  topBook: BookStats | null;
  readingTimeDistribution: TimeDistribution[];
}

type WeeklySessionRow = {
  id: number;
  book_id: number;
  minutes_read: number;
  date: string;
  created_at: string;
  notes: string | null;
  book_name: string;
  book_author: string;
};

type UseWeeklyStatsParams = {
  weekStart: Date;
};

export const useWeeklyStats = ({ weekStart }: UseWeeklyStatsParams) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(30);

  const getLocalizedWeekday = useCallback(
    (date: Date): string => {
      const dayIndex = date.getDay();
      const mondayFirstIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      return t(`components.readingLogs.weekdays.${weekdays[mondayFirstIndex]}`);
    },
    [t],
  );

  const getDailyBreakdown = useCallback(
    (
      currentWeekStart: Date,
      sessions: WeeklySessionRow[],
      goalMinutes: number,
    ): DailyStats[] => {
      const dailyStats: DailyStats[] = [];

      for (let index = 0; index < 7; index++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + index);
        const dateString = dateToLocalDateString(date);

        const daySessions = sessions.filter(
          (session) => session.date === dateString,
        );
        const dayMinutes = daySessions.reduce(
          (sum, session) => sum + session.minutes_read,
          0,
        );

        dailyStats.push({
          date: dateString,
          dayName: getLocalizedWeekday(date),
          minutes: dayMinutes,
          sessions: daySessions.length,
          goalMet: dayMinutes >= goalMinutes,
        });
      }

      return dailyStats;
    },
    [getLocalizedWeekday],
  );

  const calculateStreakInfo = useCallback(
    async (
      startDate: string,
      endDate: string,
      goalMinutes: number,
    ): Promise<StreakInfo> => {
      const dailyTotals = await queryAll<{
        date: string;
        total_minutes: number;
      }>(
        `
        SELECT rs.date, SUM(rs.minutes_read) as total_minutes
        FROM reading_sessions rs
        WHERE rs.date <= ?
        GROUP BY rs.date
        ORDER BY rs.date DESC
      `,
        [endDate],
      );

      let currentStreak = 0;
      let longestStreak = 0;
      let temporaryStreak = 0;
      let streakThisWeek = 0;

      const today = getTodayDateString();
      let checkDate = today;

      for (const day of dailyTotals) {
        if (day.date === checkDate && day.total_minutes >= goalMinutes) {
          currentStreak++;
          const checkDateObj = new Date(checkDate);
          checkDateObj.setDate(checkDateObj.getDate() - 1);
          checkDate = dateToLocalDateString(checkDateObj);
        } else {
          break;
        }
      }

      for (const day of dailyTotals) {
        if (day.total_minutes >= goalMinutes) {
          temporaryStreak++;
          longestStreak = Math.max(longestStreak, temporaryStreak);

          if (day.date >= startDate && day.date <= endDate) {
            streakThisWeek++;
          }
        } else {
          temporaryStreak = 0;
        }
      }

      return {
        currentStreak,
        longestStreak,
        streakThisWeek,
      };
    },
    [],
  );

  const getTopBook = useCallback(
    (sessions: WeeklySessionRow[]): BookStats | null => {
      if (sessions.length === 0) {
        return null;
      }

      const bookStats = sessions.reduce(
        (accumulator, session) => {
          const key = `${session.book_name}|||${session.book_author}`;
          if (!accumulator[key]) {
            accumulator[key] = {
              bookName: session.book_name,
              bookAuthor: session.book_author,
              minutesRead: 0,
              sessionsCount: 0,
            };
          }

          accumulator[key].minutesRead += session.minutes_read;
          accumulator[key].sessionsCount++;
          return accumulator;
        },
        {} as Record<string, BookStats>,
      );

      const books = Object.values(bookStats);
      if (books.length === 0) {
        return null;
      }

      return books.reduce((topBook, book) =>
        book.minutesRead > topBook.minutesRead ? book : topBook,
      );
    },
    [],
  );

  const getTimeDistribution = useCallback(
    (sessions: WeeklySessionRow[]): TimeDistribution[] => {
      const ranges = {
        "Morning (6-12)": 0,
        "Afternoon (12-17)": 0,
        "Evening (17-21)": 0,
        "Night (21-6)": 0,
      };

      sessions.forEach((session) => {
        const hour = new Date(session.created_at).getHours();
        if (hour >= 6 && hour < 12) {
          ranges["Morning (6-12)"] += session.minutes_read;
        } else if (hour >= 12 && hour < 17) {
          ranges["Afternoon (12-17)"] += session.minutes_read;
        } else if (hour >= 17 && hour < 21) {
          ranges["Evening (17-21)"] += session.minutes_read;
        } else {
          ranges["Night (21-6)"] += session.minutes_read;
        }
      });

      const total = Object.values(ranges).reduce(
        (sum, value) => sum + value,
        0,
      );

      return Object.entries(ranges).map(([timeRange, minutes]) => ({
        timeRange,
        minutes,
        percentage: total > 0 ? (minutes / total) * 100 : 0,
      }));
    },
    [],
  );

  const loadWeeklyStats = useCallback(async () => {
    try {
      setLoading(true);

      const userPrefs = await queryFirst<{
        current_reading_rate_minutes_per_day: number;
      }>(
        "SELECT current_reading_rate_minutes_per_day FROM user_preferences WHERE id = 1",
      );
      const goalMinutes = userPrefs?.current_reading_rate_minutes_per_day || 30;
      setDailyGoal(goalMinutes);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const startDateString = dateToLocalDateString(weekStart);
      const endDateString = dateToLocalDateString(weekEnd);

      const sessions = await queryAll<WeeklySessionRow>(
        `
        SELECT rs.*, eb.name as book_name, eb.author as book_author
        FROM reading_sessions rs
        JOIN enhanced_books eb ON rs.book_id = eb.id
        WHERE rs.date BETWEEN ? AND ?
        ORDER BY rs.date, rs.created_at
      `,
        [startDateString, endDateString],
      );

      const dailyBreakdown = getDailyBreakdown(
        weekStart,
        sessions,
        goalMinutes,
      );
      const totalMinutes = sessions.reduce(
        (sum, session) => sum + session.minutes_read,
        0,
      );
      const readingDaysSet = new Set(sessions.map((session) => session.date));
      const readingDays = readingDaysSet.size;
      const averageMinutesPerDay = readingDays > 0 ? totalMinutes / 7 : 0;

      const uniqueBooks = [
        ...new Set(
          sessions.map(
            (session) => `${session.book_name} by ${session.book_author}`,
          ),
        ),
      ];

      const weeklyGoal = goalMinutes * 7;
      const goalProgress =
        weeklyGoal > 0 ? (totalMinutes / weeklyGoal) * 100 : 0;

      const streakInfo = await calculateStreakInfo(
        startDateString,
        endDateString,
        goalMinutes,
      );
      const topBook = getTopBook(sessions);
      const timeDistribution = getTimeDistribution(sessions);

      setStats({
        weekStart: startDateString,
        weekEnd: endDateString,
        totalMinutes,
        averageMinutesPerDay,
        readingDays,
        sessionsCount: sessions.length,
        booksRead: uniqueBooks,
        dailyBreakdown,
        goalProgress,
        streakInfo,
        topBook,
        readingTimeDistribution: timeDistribution,
      });
    } catch (error) {
      console.error("Error loading weekly stats:", error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [
    calculateStreakInfo,
    getDailyBreakdown,
    getTimeDistribution,
    getTopBook,
    weekStart,
  ]);

  useEffect(() => {
    loadWeeklyStats();
  }, [loadWeeklyStats]);

  return {
    stats,
    loading,
    dailyGoal,
    loadWeeklyStats,
  };
};
