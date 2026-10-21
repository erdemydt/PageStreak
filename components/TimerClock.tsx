import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleProp, Text, TextStyle } from "react-native";
import {
  formatElapsed,
  getElapsedMs,
  ReadingTimerState,
} from "../utils/readingTimer";

/**
 * Live "⏱ 12:34" for a running timer. Ticks on its own so the screen around
 * it doesn't re-render every second; the time itself comes from timestamps.
 */
export default function TimerClock({
  timer,
  style,
}: {
  timer: ReadingTimerState;
  style?: StyleProp<TextStyle>;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = getElapsedMs(timer, now);
  return (
    <Text
      style={style}
      accessibilityLabel={t("home.timer.runningA11y", {
        minutes: Math.floor(elapsedMs / 60000),
      })}
    >
      ⏱ {formatElapsed(elapsedMs)}
    </Text>
  );
}
