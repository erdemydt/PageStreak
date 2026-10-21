import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../themes/colors";
import {
  addDaysToDateString,
  dateToLocalDateString,
  getTodayDateString,
  parseLocalDateString,
} from "../utils/dateUtils";
import { formatDate } from "../utils/format";

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
          <TouchableOpacity
            key={chip.key}
            style={[styles.chip, chip.selected && styles.chipSelected]}
            onPress={chip.onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: chip.selected }}
          >
            <Text
              style={[
                styles.chipText,
                chip.selected && styles.chipTextSelected,
              ]}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showPicker && (
        <DateTimePicker
          value={parseLocalDateString(value)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          maximumDate={new Date()}
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
    gap: 8,
  },
  chip: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
    alignItems: "center",
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[500],
  },
  chipTextSelected: {
    color: COLORS.white,
  },
});
