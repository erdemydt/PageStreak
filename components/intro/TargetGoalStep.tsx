import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../themes/colors";
import { formatDate } from "../../utils/format";
import { computeGrowthGoalFields } from "../../utils/goalSettings";
import { introStyles as styles } from "./introStyles";

interface TargetGoalStepProps {
  dailyReadingGoal: string;
  targetDailyGoal: string;
  onChangeTargetDailyGoal: (value: string) => void;
  goalDate: Date;
  onChangeGoalDate: (date: Date) => void;
  wantsReminders: boolean;
  onChangeWantsReminders: (value: boolean) => void;
  error: string | null;
  onClearError: () => void;
  loading: boolean;
}

/**
 * Onboarding's last step: target daily minutes, target date, the resulting
 * "+N min/week" plan (same model the app applies), and the reminder opt-in.
 */
export default function TargetGoalStep({
  dailyReadingGoal,
  targetDailyGoal,
  onChangeTargetDailyGoal,
  goalDate,
  onChangeGoalDate,
  wantsReminders,
  onChangeWantsReminders,
  error,
  onClearError,
  loading,
}: TargetGoalStepProps) {
  const { t } = useTranslation();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const initial = Number(dailyReadingGoal);
  const target = Number(targetDailyGoal);
  const weeklyIncreaseMinutes =
    initial > 0 && target > initial
      ? computeGrowthGoalFields({
          currentDailyGoal: initial,
          targetDailyGoal: target,
          targetDate: goalDate.toISOString(),
        }).weeklyIncreaseMinutes
      : 0;

  const classifyPercentageIncrease = (percentage: number) => {
    if (percentage <= 5) return t("intro.percentageClassification.minimal");
    if (percentage <= 15) return t("intro.percentageClassification.easy");
    if (percentage <= 40) return t("intro.percentageClassification.moderate");
    if (percentage <= 80)
      return t("intro.percentageClassification.challenging");
    if (percentage <= 150)
      return t("intro.percentageClassification.veryDifficult");
    return t("intro.percentageClassification.nearlyImpossible");
  };

  return (
    <View
      style={{
        flex: 1,
        gap: 0,
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>🚀</Text>
        <Text style={styles.stepTitle}>{t("intro.targetGoal.title")}</Text>
        <Text style={styles.stepSubtitle}>
          {t("intro.targetGoal.subtitle")}
        </Text>
      </View>

      <View style={styles.goalContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder={t("intro.targetGoal.placeholder")}
          placeholderTextColor={COLORS.neutral[400]}
          value={targetDailyGoal}
          onChangeText={(text) => {
            // Only allow numbers
            const numericText = text.replace(/[^0-9]/g, "");
            if (numericText.length <= 4) {
              // Max 9999 minutes
              onChangeTargetDailyGoal(numericText);
              if (
                error &&
                numericText &&
                Number(numericText) > 0 &&
                Number(numericText) <= 480 &&
                Number(numericText) >= Number(dailyReadingGoal)
              ) {
                onClearError();
              }
            }
          }}
          editable={!loading}
          keyboardType="numeric"
          returnKeyType="done"
          autoFocus
          maxLength={4}
        />
        <Text style={styles.goalLabel}>{t("intro.targetGoal.label")}</Text>
      </View>

      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}></Text>
        <Text style={styles.stepTitle}>{t("intro.targetGoal.dateLabel")}</Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {Platform.OS === "ios" ? (
          // iOS: Show inline date picker that's always visible
          <View style={styles.iosDatePickerContainer}>
            <Text style={styles.dateSelectionTitle}>
              {t("intro.targetGoal.selectDate")}
            </Text>
            <DateTimePicker
              value={goalDate}
              mode="date"
              display="compact"
              minimumDate={new Date()}
              maximumDate={
                new Date(new Date().setFullYear(new Date().getFullYear() + 5))
              }
              onChange={(event, date) => {
                if (date && event.type !== "dismissed") {
                  onChangeGoalDate(date);
                  // Clear error if date is valid
                  if (
                    error &&
                    date >= new Date(new Date().setHours(0, 0, 0, 0))
                  ) {
                    onClearError();
                  }
                }
              }}
              style={styles.iosDatePicker}
            />
            <Text style={styles.selectedDateText}>
              {t("intro.targetGoal.selectedDate")}:{" "}
              {formatDate(goalDate, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        ) : (
          // Android: Show button that opens modal date picker
          <View style={styles.androidDatePickerContainer}>
            <Text style={styles.dateSelectionTitle}>
              {t("intro.targetGoal.selectDate")}
            </Text>
            <TouchableOpacity
              style={[
                styles.datePickerButton,
                !goalDate && styles.datePickerButtonUnselected,
              ]}
              onPress={() => setShowDatePicker(true)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.datePickerButtonText,
                  !goalDate && styles.datePickerButtonTextUnselected,
                ]}
              >
                📅{" "}
                {goalDate
                  ? formatDate(goalDate, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : t("intro.targetGoal.tapToSelectDate")}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={goalDate || new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()}
                maximumDate={
                  new Date(new Date().setFullYear(new Date().getFullYear() + 5))
                }
                onChange={(event, date) => {
                  // Always hide picker on Android
                  setShowDatePicker(false);

                  // Only update date if user didn't cancel
                  if (date && event.type !== "dismissed") {
                    onChangeGoalDate(date);
                    // Clear error if date is valid
                    if (
                      error &&
                      date >= new Date(new Date().setHours(0, 0, 0, 0))
                    ) {
                      onClearError();
                    }
                  }
                }}
              />
            )}
          </View>
        )}

        <Text style={styles.weeklyIncreaseText}>
          {t("intro.targetGoal.currentWeeklyIncrease", {
            minutes: weeklyIncreaseMinutes,
            classification: classifyPercentageIncrease(
              Number(dailyReadingGoal) > 0
                ? (weeklyIncreaseMinutes / Number(dailyReadingGoal)) * 100
                : 0,
            ),
          })}
        </Text>
      </View>

      <Text style={styles.goalHint}>🎯 {t("intro.targetGoal.hint")}</Text>

      <View style={styles.reminderCard}>
        <View style={styles.reminderTextBlock}>
          <Text style={styles.reminderTitle}>
            🔔 {t("intro.reminder.title")}
          </Text>
          <Text style={styles.reminderSubtitle}>
            {t("intro.reminder.subtitle")}
          </Text>
        </View>
        <Switch
          value={wantsReminders}
          onValueChange={onChangeWantsReminders}
          trackColor={{
            false: COLORS.neutral[200],
            true: COLORS.state.primarySoft,
          }}
          thumbColor={wantsReminders ? COLORS.primary : COLORS.neutral[400]}
        />
      </View>
    </View>
  );
}
