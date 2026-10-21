import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The Home card's reading timer. Stored as timestamps (not a ticking count),
 * so it keeps running while the app is backgrounded or even killed.
 *
 * States: running (startedAt), stopped (startedAt + stoppedAt; waiting to be
 * logged or discarded), or none.
 */
export type ReadingTimerState = {
  startedAt: string;
  stoppedAt?: string;
  bookId?: number;
};

const STORAGE_KEY = "pagestreak_reading_timer";

export async function getReadingTimer(): Promise<ReadingTimerState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReadingTimerState) : null;
  } catch (error) {
    console.error("Error reading timer state:", error);
    return null;
  }
}

async function saveReadingTimer(
  state: ReadingTimerState | null,
): Promise<void> {
  if (state) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export async function startReadingTimer(
  bookId?: number,
): Promise<ReadingTimerState> {
  const state = { startedAt: new Date().toISOString(), bookId };
  await saveReadingTimer(state);
  return state;
}

/** Freeze the elapsed time; the timer then waits to be logged or discarded */
export async function stopReadingTimer(): Promise<ReadingTimerState | null> {
  const state = await getReadingTimer();
  if (!state || state.stoppedAt) return state;
  const stopped = { ...state, stoppedAt: new Date().toISOString() };
  await saveReadingTimer(stopped);
  return stopped;
}

export async function clearReadingTimer(): Promise<void> {
  await saveReadingTimer(null);
}

export function getElapsedMs(
  state: ReadingTimerState,
  now: number = Date.now(),
): number {
  const end = state.stoppedAt ? new Date(state.stoppedAt).getTime() : now;
  return Math.max(0, end - new Date(state.startedAt).getTime());
}

/** Whole minutes to log (at least 1) */
export function getElapsedMinutes(state: ReadingTimerState): number {
  return Math.max(1, Math.round(getElapsedMs(state) / 60000));
}

/** "12:34" or "1:02:03" */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
