import type { TFunction } from "i18next";
import { useCallback, useState } from "react";
import { Alert, Keyboard } from "react-native";
import { execute, queryFirst } from "../db/db";
import type { UserPreferences } from "../types/database";
import {
    computeGrowthGoalFields,
    validateGrowthGoals,
} from "../utils/goalSettings";

type UseUserPreferencesParams = {
  t: TFunction;
};

const formatDateForInput = (dateString?: string | null) => {
  if (!dateString) {
    return "";
  }

  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return `${String(parsedDate.getDate()).padStart(2, "0")}/${String(
    parsedDate.getMonth() + 1,
  ).padStart(2, "0")}/${parsedDate.getFullYear()}`;
};

export const useUserPreferences = ({ t }: UseUserPreferencesParams) => {
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState("");
  const [editedYearlyGoal, setEditedYearlyGoal] = useState("");
  const [editedDailyGoal, setEditedDailyGoal] = useState("");
  const [editedTargetGoal, setEditedTargetGoal] = useState("");
  const [editedTargetDate, setEditedTargetDate] = useState("");
  const [loading, setLoading] = useState(false);

  const populateEditFields = useCallback((user: UserPreferences) => {
    setEditedUsername(user.username);
    setEditedYearlyGoal(user.yearly_book_goal.toString());
    setEditedDailyGoal(
      user.current_reading_rate_minutes_per_day?.toString() || "30",
    );
    setEditedTargetGoal(
      user.end_reading_rate_goal_minutes_per_day?.toString() || "60",
    );
    setEditedTargetDate(formatDateForInput(user.end_reading_rate_goal_date));
  }, []);

  const loadUserPreferences = useCallback(async () => {
    try {
      const user = await queryFirst<UserPreferences>(
        "SELECT * FROM user_preferences WHERE id = 1",
      );
      if (user) {
        setUserPreferences(user);
        populateEditFields(user);
      }
    } catch (error) {
      console.error("Failed to load user preferences:", error);
    }
  }, [populateEditFields]);

  const savePreferences = useCallback(async () => {
    const yearlyGoal = Number(editedYearlyGoal);
    const currentDailyGoal = Number(editedDailyGoal);
    const targetDailyGoal = Number(editedTargetGoal);
    const normalizedTargetDate = editedTargetDate.trim() || null;

    if (!editedUsername.trim()) {
      Alert.alert(
        t("profile.error.title"),
        t("profile.validation.usernameRequired"),
      );
      return;
    }

    if (!Number.isFinite(yearlyGoal) || yearlyGoal <= 0) {
      Alert.alert(
        t("profile.error.title"),
        t("profile.validation.yearlyGoalRequired"),
      );
      return;
    }

    const growthValidation = validateGrowthGoals({
      currentDailyGoal,
      targetDailyGoal,
      targetDate: normalizedTargetDate,
    });

    if (growthValidation) {
      const messageKey =
        growthValidation === "current_daily_required" ||
        growthValidation === "current_daily_range"
          ? "profile.validation.dailyGoalRequired"
          : "profile.validation.targetGoalRequired";

      Alert.alert(t("profile.error.title"), t(messageKey));
      return;
    }

    setLoading(true);
    try {
      const computedGoals = computeGrowthGoalFields({
        currentDailyGoal,
        targetDailyGoal,
        targetDate: normalizedTargetDate,
      });

      await execute(
        `UPDATE user_preferences SET 
          username = ?, 
          yearly_book_goal = ?, 
          initial_reading_rate_minutes_per_day = ?,
          end_reading_rate_goal_minutes_per_day = ?,
          end_reading_rate_goal_date = ?,
          current_reading_rate_minutes_per_day = ?,
          current_reading_rate_last_updated = ?,
          weekly_reading_rate_increase_minutes = ?,
          weekly_reading_rate_increase_minutes_percentage = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`,
        [
          editedUsername.trim(),
          yearlyGoal,
          computedGoals.initialReadingRate,
          computedGoals.targetReadingRate,
          computedGoals.endGoalDate,
          computedGoals.currentReadingRate,
          new Date().toISOString(),
          computedGoals.weeklyIncreaseMinutes,
          computedGoals.weeklyIncreasePercentage,
        ],
      );

      await loadUserPreferences();
      setIsEditing(false);
      Alert.alert(t("profile.success.title"), t("profile.success.message"));
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert(t("profile.error.title"), t("profile.error.message"));
    } finally {
      setLoading(false);
    }
  }, [
    editedDailyGoal,
    editedTargetDate,
    editedTargetGoal,
    editedUsername,
    editedYearlyGoal,
    loadUserPreferences,
    t,
  ]);

  const cancelEdit = useCallback(() => {
    Keyboard.dismiss();
    if (userPreferences) {
      populateEditFields(userPreferences);
    }
    setIsEditing(false);
  }, [populateEditFields, userPreferences]);

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return "Not set";

    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  }, []);

  return {
    userPreferences,
    isEditing,
    setIsEditing,
    editedUsername,
    setEditedUsername,
    editedYearlyGoal,
    setEditedYearlyGoal,
    editedDailyGoal,
    setEditedDailyGoal,
    editedTargetGoal,
    setEditedTargetGoal,
    editedTargetDate,
    setEditedTargetDate,
    loading,
    loadUserPreferences,
    savePreferences,
    cancelEdit,
    formatDate,
  };
};
