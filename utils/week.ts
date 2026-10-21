import { listSessionMinutes } from "../db/repos/sessions";
import {
  addDaysToDateString,
  getTodayDateString,
  parseLocalDateString,
} from "./dateUtils";
import { getAppLocale } from "./format";
import { loadGoalForDate } from "./goalHistory";

export type WeekDayState = "met" | "missed" | "today" | "upcoming";

export type WeekDay = {
  /** YYYY-MM-DD */
  date: string;
  minutes: number;
  /** The goal in effect that day (goal_history) */
  goal: number;
  state: WeekDayState;
  /** Today only: whether the goal is already met */
  metToday: boolean;
};

/** The seven local dates (YYYY-MM-DD) of the Monday-first week containing `date` */
export function getWeekDates(date: string = getTodayDateString()): string[] {
  const day = parseLocalDateString(date).getDay(); // 0 = Sunday
  const monday = addDaysToDateString(date, day === 0 ? -6 : 1 - day);
  return Array.from({ length: 7 }, (_, i) => addDaysToDateString(monday, i));
}

/** "M", "T", … (narrow) or "Monday" (long), in the app language */
export function formatWeekday(
  date: string,
  width: "narrow" | "long" = "narrow",
): string {
  const locale = getAppLocale();
  // Turkish narrow weekdays repeat letters (P S Ç P C C P); use "Pzt", "Sal", …
  const weekday = width === "narrow" && locale.startsWith("tr") ? "short" : width;
  return new Intl.DateTimeFormat(locale, { weekday }).format(
    parseLocalDateString(date),
  );
}

/** This week's days, each judged against the goal that applied that day */
export async function loadWeek(
  today: string = getTodayDateString(),
): Promise<WeekDay[]> {
  const dates = getWeekDates(today);
  const [sessions, goalForDate] = await Promise.all([
    listSessionMinutes(dates[0], dates[6]),
    loadGoalForDate(),
  ]);

  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(session.date, (totals.get(session.date) ?? 0) + session.minutes_read);
  }

  return dates.map((date) => {
    const minutes = totals.get(date) ?? 0;
    const goal = goalForDate(date);
    const met = minutes >= goal;
    const state: WeekDayState =
      date > today ? "upcoming" : date === today ? "today" : met ? "met" : "missed";
    return { date, minutes, goal, state, metToday: date === today && met };
  });
}
