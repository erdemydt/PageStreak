import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getUserPreferences, updateProfile } from "../../db/repos/preferences";
import type { UserPreferences } from "../../types/models";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { TYPE } from "../../themes/typography";
import {
  computeGrowthGoalFields,
  validateGrowthGoals,
} from "../../utils/goalSettings";
import { formatDate } from "../../utils/format";
import { genreLabel, GENRE_KEYS, parseGenres } from "../../utils/genres";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { showToast } from "../../utils/toast";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields
  const [editedUsername, setEditedUsername] = useState("");
  const [editedYearlyGoal, setEditedYearlyGoal] = useState("");
  const [editedDailyGoal, setEditedDailyGoal] = useState("");
  const [editedTargetGoal, setEditedTargetGoal] = useState("");
  const [editedGenres, setEditedGenres] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  const genres = GENRE_KEYS;

  // Background reloads (focus, data-change events) must not overwrite what
  // the user is typing; edit fields are only refreshed when not editing
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;

  const loadUserPreferences = useCallback(async () => {
    try {
      const user = await getUserPreferences();
      if (user) {
        setUserPreferences(user);
        if (!isEditingRef.current) {
          populateEditFields(user);
        }
      }
    } catch (e) {
      console.error("Failed to load user preferences:", e);
    }
  }, []);

  useFocusRefresh(loadUserPreferences, ["preferences"]);

  const populateEditFields = (user: UserPreferences) => {
    setEditedUsername(user.username);
    setEditedYearlyGoal(user.yearly_book_goal.toString());
    setEditedDailyGoal(
      user.current_reading_rate_minutes_per_day?.toString() || "30",
    );
    setEditedTargetGoal(
      user.end_reading_rate_goal_minutes_per_day?.toString() || "60",
    );
    setEditedGenres(parseGenres(user.preferred_genres));
  };

  const toggleGenre = (genre: string) => {
    setEditedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  };

  const savePreferences = async () => {
    const yearlyGoal = Number(editedYearlyGoal);
    const currentDailyGoal = Number(editedDailyGoal);
    const targetDailyGoal = Number(editedTargetGoal);

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
      targetDate: userPreferences?.end_reading_rate_goal_date,
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
      const goalsChanged =
        currentDailyGoal !==
          userPreferences?.current_reading_rate_minutes_per_day ||
        targetDailyGoal !==
          userPreferences?.end_reading_rate_goal_minutes_per_day;

      // Only re-plan growth when the goals actually changed; otherwise the
      // initial rate, last-updated date and weekly increase would reset
      await updateProfile(
        {
          username: editedUsername.trim(),
          yearlyBookGoal: yearlyGoal,
          preferredGenres: editedGenres,
        },
        goalsChanged
          ? computeGrowthGoalFields({
              currentDailyGoal,
              targetDailyGoal,
              targetDate: userPreferences?.end_reading_rate_goal_date,
            })
          : null,
      );

      isEditingRef.current = false;
      setIsEditing(false);
      await loadUserPreferences();
      showToast({ message: t("profile.success.message") });
    } catch (e) {
      console.error("Save error:", e);
      Alert.alert(t("profile.error.title"), t("profile.error.message"));
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    Keyboard.dismiss();
    if (userPreferences) {
      populateEditFields(userPreferences);
    }
    setIsEditing(false);
  };

  const formatOptionalDate = (dateString?: string) =>
    dateString ? formatDate(dateString) : "—";

  const renderViewMode = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userPreferences?.username.charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {userPreferences?.username || t("profile.labels.username")}
          </Text>
          <Text style={styles.profileSubtitle}>{t("profile.subtitle")}</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setIsEditing(true)}
        >
          <Ionicons name="pencil" size={18} color={COLORS.primary} />
          <Text style={styles.editButtonText}>{t("profile.edit")}</Text>
        </TouchableOpacity>
      </View>

      {/* Reading Goals Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.sections.goals")}</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="library" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {t("profile.fields.yearlyGoal")}
              </Text>
              <Text style={styles.infoValue}>
                {userPreferences?.yearly_book_goal || 0} {t("intro.goal.label")}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="time" size={20} color={COLORS.success} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {t("profile.fields.currentDailyGoal")}
              </Text>
              <Text style={styles.infoValue}>
                {userPreferences?.current_reading_rate_minutes_per_day || 0}{" "}
                {t("profile.units.minutes")}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="trending-up" size={20} color={COLORS.warning} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {t("profile.fields.targetDailyGoal")}
              </Text>
              <Text style={styles.infoValue}>
                {userPreferences?.end_reading_rate_goal_minutes_per_day || 0}{" "}
                {t("profile.units.minutes")}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar" size={20} color={COLORS.danger} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {t("profile.labels.weeklyGoal")}
              </Text>
              <Text style={styles.infoValue}>
                {/* weekly_reading_goal is frozen at onboarding; derive from today's goal */}
                {(userPreferences?.current_reading_rate_minutes_per_day || 0) *
                  7}{" "}
                {t("profile.units.minutes")}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.growthJourneyButton}
          onPress={() => router.push("/(tabs)/reading-growth")}
        >
          <View style={styles.growthJourneyIconWrap}>
            <Ionicons
              name="stats-chart"
              size={18}
              color={COLORS.accent.strong}
            />
          </View>
          <View style={styles.growthJourneyTextWrap}>
            <Text style={styles.growthJourneyTitle}>
              {t("profile.growth.title")}
            </Text>
            <Text style={styles.growthJourneySubtitle}>
              {t("profile.growth.subtitle")}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.neutral[500]}
          />
        </TouchableOpacity>
      </View>

      {/* Reading Progress Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("profile.sections.statistics")}
        </Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="trending-up"
                size={20}
                color={COLORS.state.readingHeat4}
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {t("profile.stats.totalIncrease")}
              </Text>
              <Text style={styles.infoValue}>
                {userPreferences?.current_reading_rate_minutes_per_day !=
                  null &&
                userPreferences?.initial_reading_rate_minutes_per_day != null
                  ? (
                      ((userPreferences.current_reading_rate_minutes_per_day -
                        userPreferences.initial_reading_rate_minutes_per_day) /
                        userPreferences.initial_reading_rate_minutes_per_day) *
                      100
                    ).toFixed(2)
                  : 0}
                %
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="speedometer"
                size={20}
                color={COLORS.state.readingHeat4}
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {t("profile.stats.currentRate")}
              </Text>
              <Text style={styles.infoValue}>
                {userPreferences?.current_reading_rate_minutes_per_day || 0}{" "}
                {t("profile.units.minPerDay")}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="stats-chart"
                size={20}
                color={COLORS.state.accentCyan}
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {t("profile.stats.startingRate")}
              </Text>
              <Text style={styles.infoValue}>
                {userPreferences?.initial_reading_rate_minutes_per_day || 0}{" "}
                {t("profile.units.minPerDay")}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="flag" size={20} color={COLORS.state.accentRose} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {t("profile.stats.goalTargetDate")}
              </Text>
              <Text style={styles.infoValue}>
                {formatOptionalDate(
                  userPreferences?.end_reading_rate_goal_date,
                )}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Preferred Genres Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("profile.fields.favoriteGenres")}
        </Text>
        <View style={styles.card}>
          <View style={styles.genresDisplay}>
            {userPreferences?.preferred_genres ? (
              parseGenres(userPreferences.preferred_genres).map((genre) => (
                <View key={genre} style={styles.genreTag}>
                  <Text style={styles.genreTagText}>{genreLabel(genre)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noGenresText}>
                {t("profile.stats.noGenres")}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Account Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.sections.account")}</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={COLORS.neutral[500]}
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {t("profile.account.memberSince")}
              </Text>
              <Text style={styles.infoValue}>
                {formatOptionalDate(userPreferences?.created_at)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="refresh-outline"
                size={20}
                color={COLORS.neutral[500]}
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {t("profile.account.lastUpdated")}
              </Text>
              <Text style={styles.infoValue}>
                {formatOptionalDate(userPreferences?.updated_at)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderEditMode = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={cancelEdit}
        disabled={loading}
      >
        <Ionicons name="close" size={25} color={COLORS.neutral[700]} />
      </TouchableOpacity>
      <View style={styles.editHeader}>
        <Text style={styles.editTitle}>{t("profile.edit")}</Text>

        <Text style={styles.editSubtitle}>{t("profile.subtitle")}</Text>
      </View>

      {/* Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("profile.sections.personal")}
        </Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="person" size={16} color={COLORS.primary} />{" "}
              {t("profile.fields.username")}
            </Text>
            <TextInput
              style={styles.input}
              value={editedUsername}
              onChangeText={setEditedUsername}
              placeholder={t("profile.placeholders.username")}
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="library" size={16} color={COLORS.primary} />{" "}
              {t("profile.fields.yearlyGoal")}
            </Text>
            <TextInput
              style={styles.input}
              value={editedYearlyGoal}
              onChangeText={setEditedYearlyGoal}
              placeholder={t("profile.placeholders.yearlyGoal")}
              keyboardType="numeric"
              editable={!loading}
            />
          </View>
        </View>
      </View>

      {/* Reading Time Goals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.sections.goals")}</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="time" size={16} color={COLORS.success} />{" "}
              {t("profile.fields.currentDailyGoal")}
            </Text>
            <TextInput
              style={styles.input}
              value={editedDailyGoal}
              onChangeText={setEditedDailyGoal}
              placeholder={t("profile.placeholders.dailyGoal")}
              keyboardType="numeric"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="trending-up" size={16} color={COLORS.warning} />{" "}
              {t("profile.fields.targetDailyGoal")}
            </Text>
            <TextInput
              style={styles.input}
              value={editedTargetGoal}
              onChangeText={setEditedTargetGoal}
              placeholder={t("profile.placeholders.targetGoal")}
              keyboardType="numeric"
              editable={!loading}
            />
          </View>
        </View>
      </View>

      {/* Preferred Genres */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("profile.sections.preferredGenres")}
        </Text>
        <View style={styles.card}>
          <View style={styles.genresGrid}>
            {genres.map((genre) => (
              <TouchableOpacity
                key={genre}
                style={[
                  styles.genreChip,
                  editedGenres.includes(genre) && styles.genreChipSelected,
                ]}
                onPress={() => toggleGenre(genre)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.genreChipText,
                    editedGenres.includes(genre) &&
                      styles.genreChipTextSelected,
                  ]}
                >
                  {genreLabel(genre)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.editActions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={cancelEdit}
          disabled={loading}
        >
          <Ionicons name="close" size={18} color={COLORS.neutral[500]} />
          <Text style={styles.cancelButtonText}>
            {t("profile.buttons.cancel")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={savePreferences}
          disabled={loading}
        >
          <Ionicons name="checkmark" size={18} color={COLORS.white} />
          <Text style={styles.saveButtonText}>
            {loading
              ? t("profile.buttons.saving")
              : t("profile.buttons.saveChanges")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
      </View>

      {isEditing ? renderEditMode() : renderViewMode()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface.page,
  },
  header: {
    backgroundColor: COLORS.surface.page,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
  },
  backButton: {
    position: "absolute",
    top: 16,
    left: 5,
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.neutral[800],
  },
  headerSpacer: {
    height: 40,
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING[4],
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface.raised,
    padding: SPACING[4],
    borderRadius: 16,
    marginTop: SPACING[4],
    marginBottom: SPACING[5],
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "bold",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  profileSubtitle: {
    ...TYPE.meta,
    fontWeight: "500",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.neutral[100],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    marginBottom: SPACING[4],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginBottom: SPACING[2],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: COLORS.surface.raised,
    borderRadius: 16,
    padding: SPACING[4],
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral[50],
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: "500",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: COLORS.text.primary,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.neutral[200],
    marginHorizontal: -SPACING[4],
  },
  growthJourneyButton: {
    marginTop: SPACING[2],
    backgroundColor: COLORS.surface.raised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  growthJourneyIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.state.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  growthJourneyTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  growthJourneyTitle: {
    fontSize: 14,
    color: COLORS.text.primary,
    fontWeight: "600",
  },
  growthJourneySubtitle: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  genresDisplay: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genreTag: {
    backgroundColor: COLORS.accent.soft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  genreTagText: {
    color: COLORS.accent.strong,
    fontSize: 12,
    fontWeight: "600",
  },
  noGenresText: {
    color: COLORS.neutral[400],
    fontStyle: "italic",
  },
  editHeader: {
    alignItems: "center",
    paddingVertical: 20,
  },
  editTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  editSubtitle: {
    ...TYPE.body,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    height: 48,
    borderColor: COLORS.neutral[200],
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface.raised,
    fontSize: 16,
    color: COLORS.text.primary,
  },
  genresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genreChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.surface.muted,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  genreChipSelected: {
    backgroundColor: COLORS.accent.soft,
    borderColor: COLORS.accent.primary,
  },
  genreChipText: {
    fontSize: 14,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  genreChipTextSelected: {
    color: COLORS.accent.strong,
    fontWeight: "600",
  },
  editActions: {
    flexDirection: "row",
    gap: SPACING[2],
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[4],
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.neutral[100],
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  cancelButtonText: {
    color: COLORS.neutral[500],
    fontWeight: "600",
    fontSize: 16,
  },
  saveButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
  },
  bottomSpacer: {
    height: 40,
  },
});
