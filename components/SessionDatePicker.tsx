import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import { COLORS } from "../themes/colors";
import { SPACING } from "../themes/spacing";
import Chip from "./ui/Chip";
import {
  addDaysToDateString,
  dateToLocalDateString,
  getTodayDateString,
  parseLocalDateString,
} from "../utils/dateUtils";
import { formatDate, getAppLocale } from "../utils/format";

interface SessionDatePickerProps {
  /** YYYY-MM-DD */
  value: string;
  onChange: (date: string) => void;
}

/**
 * "When did you read?" chips: Today / Yesterday / a picked date.
 * Lets users backfill a session they forgot to log; future dates are blocked.
 */
export default function SessionDatePicker({
  value,
  onChange,
}: SessionDatePickerProps) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  const today = getTodayDateString();
  const yesterday = addDaysToDateString(today, -1);
  const isOtherDate = value !== today && value !== yesterday;

  const chips: {
    key: string;
    label: string;
    selected: boolean;
    onPress: () => void;
  }[] = [
    {
      key: "today",
      label: t("components.sessionDate.today"),
      selected: value === today,
      onPress: () => {
        setShowPicker(false);
        onChange(today);
      },
    },
    {
      key: "yesterday",
      label: t("components.sessionDate.yesterday"),
      selected: value === yesterday,
      onPress: () => {
        setShowPicker(false);
        onChange(yesterday);
      },
    },
    {
      key: "other",
      label: isOtherDate
        ? formatDate(value, { month: "short", day: "numeric" })
        : t("components.sessionDate.pickDate"),
      selected: isOtherDate,
      onPress: () => setShowPicker((shown) => !shown),
    },
  ];

  return (
    <View>
      <View style={styles.chipRow}>
        {chips.map((chip) => (
          <Chip
            key={chip.key}
            label={chip.label}
            selected={chip.selected}
            onPress={chip.onPress}
            grow
          />
        ))}
      </View>

      {showPicker && (
        <DateTimePicker
          value={parseLocalDateString(value)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          // iOS: month names in the app language, not the device's
          locale={getAppLocale()}
          maximumDate={new Date()}
          accentColor={COLORS.accent.primary}
          onChange={(event, date) => {
            // Android shows a dialog that closes itself; iOS stays inline
            if (Platform.OS === "android") setShowPicker(false);
            if (date && event.type !== "dismissed") {
              onChange(dateToLocalDateString(date));
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    gap: SPACING[2],
  },
});
