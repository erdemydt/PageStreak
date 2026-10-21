import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { FONTS } from "../../themes/typography";
import { formatWeekday, WeekDay } from "../../utils/week";

/**
 * Monday to Sunday between hairlines: a filled dot for each day the goal (of
 * that day) was met, a ring for today, and an outline for missed days.
 */
export default function WeekStrip({
  days,
  onPress,
}: {
  days: WeekDay[];
  onPress: () => void;
}) {
  const { t } = useTranslation();

  const dayLabel = (day: WeekDay) => {
    const name = formatWeekday(day.date, "long");
    switch (day.state) {
      case "met":
        return t("today.dayMet", { day: name });
      case "missed":
        return t("today.dayMissed", { day: name });
      case "today":
        return day.metToday
          ? t("today.dayMet", { day: name })
          : t("today.dayToday", { day: name });
      default:
        return t("today.dayUpcoming", { day: name });
    }
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t("today.thisWeek")}: ${days.map(dayLabel).join(", ")}`}
      accessibilityHint={t("today.openHistory")}
      style={({ pressed }) => [styles.strip, pressed && styles.pressed]}
    >
      {days.map((day) => (
        <View key={day.date} style={styles.day}>
          <Text
            style={[
              styles.label,
              day.state === "today" && styles.labelToday,
              day.state === "upcoming" && styles.labelUpcoming,
            ]}
          >
            {formatWeekday(day.date)}
          </Text>
          <View style={[styles.dot, DOT[day.state], day.metToday && styles.dotFilled]} />
        </View>
      ))}
    </Pressable>
  );
}

const DOT = StyleSheet.create({
  met: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
  },
  missed: {
    borderColor: COLORS.line.strong,
  },
  today: {
    borderColor: COLORS.accent.primary,
  },
  upcoming: {
    borderColor: COLORS.line.hairline,
  },
});

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    paddingVertical: SPACING[3] + 2,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderColor: COLORS.line.hairline,
  },
  pressed: {
    opacity: 0.6,
  },
  day: {
    flex: 1,
    alignItems: "center",
    gap: SPACING[2],
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: COLORS.ink.secondary,
  },
  labelToday: {
    color: COLORS.ink.primary,
  },
  labelUpcoming: {
    color: COLORS.ink.tertiary,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  dotFilled: {
    backgroundColor: COLORS.accent.primary,
  },
});
