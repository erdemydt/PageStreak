import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../themes/colors";
import { GENRE_KEYS, genreLabel } from "../../utils/genres";
import { profileStyles as styles } from "./profileStyles";

const genres = GENRE_KEYS;

interface ProfileEditFormProps {
  values: {
    username: string;
    yearlyGoal: string;
    genres: string[];
  };
  onChange: {
    username: (value: string) => void;
    yearlyGoal: (value: string) => void;
  };
  onToggleGenre: (genre: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onOpenGrowthJourney: () => void;
  loading: boolean;
}

/** Profile's edit mode: name, yearly goal, genres (daily goals live in Growth Journey) */
export default function ProfileEditForm({
  values,
  onChange,
  onToggleGenre,
  onCancel,
  onSave,
  onOpenGrowthJourney,
  loading,
}: ProfileEditFormProps) {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("a11y.close")}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.backButton}
        onPress={onCancel}
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
              value={values.username}
              onChangeText={onChange.username}
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
              value={values.yearlyGoal}
              onChangeText={onChange.yearlyGoal}
              placeholder={t("profile.placeholders.yearlyGoal")}
              keyboardType="numeric"
              editable={!loading}
            />
          </View>
        </View>
      </View>

      {/* Reading goals are edited in one place: Growth Journey */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.sections.goals")}</Text>
        <TouchableOpacity
          style={styles.growthJourneyButton}
          onPress={onOpenGrowthJourney}
          disabled={loading}
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
              {t("profile.goalsEditedInGrowth")}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.neutral[500]}
          />
        </TouchableOpacity>
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
                  values.genres.includes(genre) && styles.genreChipSelected,
                ]}
                onPress={() => onToggleGenre(genre)}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.genreChipText,
                    values.genres.includes(genre) &&
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
          onPress={onCancel}
          disabled={loading}
        >
          <Ionicons name="close" size={18} color={COLORS.neutral[500]} />
          <Text style={styles.cancelButtonText}>
            {t("profile.buttons.cancel")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={onSave}
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
}
