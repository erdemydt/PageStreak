import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Keyboard,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getUserPreferences, updateProfile } from "../../db/repos/preferences";
import type { UserPreferences } from "../../types/models";
import { COLORS } from "../../themes/colors";
import { formatDate } from "../../utils/format";
import { genreLabel, parseGenres } from "../../utils/genres";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { showToast } from "../../utils/toast";
import ProfileEditForm from "../../components/profile/ProfileEditForm";
import { profileStyles } from "../../components/profile/profileStyles";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields
  const [editedUsername, setEditedUsername] = useState("");
  const [editedYearlyGoal, setEditedYearlyGoal] = useState("");
  const [editedGenres, setEditedGenres] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

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
    setEditedGenres(parseGenres(user.preferred_genres));
  };

  const toggleGenre = (genre: string) => {
    setEditedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  };

  const savePreferences = async () => {
    const yearlyGoal = Number(editedYearlyGoal);

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

    setLoading(true);
    try {
      // Daily/target goals are edited in Growth Journey only
      await updateProfile({
        username: editedUsername.trim(),
        yearlyBookGoal: yearlyGoal,
        preferredGenres: editedGenres,
      });

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

  // Leaving edit mode for Growth Journey drops unsaved edits: ask first
  const openGrowthJourneyFromEdit = () => {
    const leave = () => {
      cancelEdit();
      router.push("/(tabs)/reading-growth");
    };
    const saved = userPreferences;
    const hasChanges =
      !!saved &&
      (editedUsername.trim() !== saved.username ||
        Number(editedYearlyGoal) !== saved.yearly_book_goal ||
        editedGenres.join(",") !==
          parseGenres(saved.preferred_genres).join(","));
    if (!hasChanges) {
      leave();
      return;
    }
    Alert.alert(
      t("profile.discardChangesTitle"),
      t("profile.discardChangesMessage"),
      [
        { text: t("booksPage.alert.cancel"), style: "cancel" },
        {
          text: t("profile.discardChanges"),
          style: "destructive",
          onPress: leave,
        },
      ],
    );
  };

  const renderEditMode = () => (
    <ProfileEditForm
      values={{
        username: editedUsername,
        yearlyGoal: editedYearlyGoal,
        genres: editedGenres,
      }}
      onChange={{
        username: setEditedUsername,
        yearlyGoal: setEditedYearlyGoal,
      }}
      onToggleGenre={toggleGenre}
      onCancel={cancelEdit}
      onSave={savePreferences}
      onOpenGrowthJourney={openGrowthJourneyFromEdit}
      loading={loading}
    />
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

const styles = profileStyles;
