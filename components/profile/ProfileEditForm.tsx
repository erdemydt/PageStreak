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
    dailyGoal: string;
    targetGoal: string;
    genres: string[];
  };
  onChange: {
    username: (value: string) => void;
    yearlyGoal: (value: string) => void;
    dailyGoal: (value: string) => void;
    targetGoal: (value: string) => void;
  };
  onToggleGenre: (genre: string) => void;
  onCancel: () => void;
  onSave: () => void;
  loading: boolean;
}

/** Profile's edit mode: name, yearly goal, daily/target minutes, genres */
export default function ProfileEditForm({
  values,
  onChange,
  onToggleGenre,
  onCancel,
  onSave,
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
              value={values.dailyGoal}
              onChangeText={onChange.dailyGoal}
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
              value={values.targetGoal}
              onChangeText={onChange.targetGoal}
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
