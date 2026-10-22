import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS } from "../../themes/colors";
import { RADIUS, SPACING } from "../../themes/spacing";
import { FONTS, TYPE } from "../../themes/typography";
import type { UserPreferences } from "../../types/models";
import { parseDbDate } from "../../utils/dateUtils";
import {
  GrowthGoalValidationError,
  updateGrowthGoals,
  validateGrowthGoals,
} from "../../utils/goalSettings";
import { showToast } from "../../utils/toast";
import Button from "../ui/Button";
import Sheet from "../ui/Sheet";

/** The stored goal date (an ISO instant) as the form's local DD/MM/YYYY */
const toFormDate = (value?: string | null) => {
  const date = parseDbDate(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const ERROR_MESSAGES: Record<GrowthGoalValidationError, string> = {
  current_daily_required: "profile.validation.dailyGoalRequired",
  current_daily_range: "profile.validation.dailyGoalRequired",
  target_daily_required: "profile.validation.targetGoalRequired",
  target_daily_range: "profile.validation.targetGoalRequired",
  target_before_current: "profile.validation.targetBelowCurrent",
  target_date_invalid: "profile.validation.dateInvalid",
  target_date_past: "profile.validation.datePast",
};

/**
 * The one editor of the daily goal, the target and the target date (Growth
 * Journey). Saving records the change in goal_history (updateGrowthGoals).
 */
export default function GoalSheet({
  visible,
  prefs,
  onClose,
}: {
  visible: boolean;
  prefs: UserPreferences | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const daily = prefs?.current_reading_rate_minutes_per_day || 30;
    setCurrent(String(daily));
    setTarget(String(prefs?.end_reading_rate_goal_minutes_per_day || daily));
    setDate(toFormDate(prefs?.end_reading_rate_goal_date));
    // Only when it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const save = async () => {
    // Never save defaults over a goal we failed to load
    if (!prefs) return;
    const input = {
      currentDailyGoal: Number(current),
      targetDailyGoal: Number(target),
      targetDate: date.trim() || null,
    };
    const validation = validateGrowthGoals(input);
    if (validation) {
      Alert.alert(t("profile.error.title"), t(ERROR_MESSAGES[validation]));
      return;
    }
    setSaving(true);
    try {
      await updateGrowthGoals(input);
      onClose();
      showToast({ message: t("growthJourney.success") });
    } catch (error) {
      console.error("Failed to save growth settings:", error);
      Alert.alert(t("profile.error.title"), t("profile.error.message"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={!saving}
      closeButton={false}
      title={t("growthJourney.edit.title")}
      footer={
        <>
          <Button
            title={t("components.bookDetailModal.cancel")}
            variant="secondary"
            onPress={onClose}
            disabled={saving}
          />
          <Button
            title={t("growthJourney.edit.save")}
            onPress={save}
            loading={saving}
            disabled={!prefs}
            grow
          />
        </>
      }
    >
      <View style={styles.form}>
        <Text style={styles.hint}>{t("growthJourney.edit.subtitle")}</Text>
        <Field label={t("profile.fields.currentDailyGoal")}>
          <TextInput
            style={styles.input}
            value={current}
            onChangeText={setCurrent}
            keyboardType="number-pad"
            maxLength={3}
            editable={!saving}
            accessibilityLabel={t("profile.fields.currentDailyGoal")}
          />
        </Field>
        <Field label={t("profile.fields.targetDailyGoal")}>
          <TextInput
            style={styles.input}
            value={target}
            onChangeText={setTarget}
            keyboardType="number-pad"
            maxLength={3}
            editable={!saving}
            accessibilityLabel={t("profile.fields.targetDailyGoal")}
          />
        </Field>
        <Field label={t("growthJourney.edit.targetDate")}>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder={t("datePlaceholder")}
            placeholderTextColor={COLORS.ink.disabled}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            editable={!saving}
            accessibilityLabel={t("growthJourney.edit.targetDate")}
          />
        </Field>
      </View>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: SPACING[4],
  },
  hint: TYPE.meta,
  field: {
    gap: SPACING[2],
  },
  label: TYPE.label,
  input: {
    minHeight: 48,
    paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line.strong,
    backgroundColor: COLORS.paper.raised,
    fontFamily: FONTS.sans,
    fontSize: 17,
    color: COLORS.ink.primary,
  },
});
