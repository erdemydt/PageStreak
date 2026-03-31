import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Keyboard,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import DataExportModal from "../../components/DataExportModal";
import DataImportModal from "../../components/DataImportModal";
import LanguageSelector from "../../components/LanguageSelector";
import NotificationSettings from "../../components/NotificationSettings";
import SettingsRow from "../../components/SettingsRow";
import { execute, queryFirst } from "../../db/db";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { TYPE } from "../../themes/typography";
import type { UserPreferences } from "../../types/database";
import { logoutUser } from "../../utils/migration";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [autoIncreaseEnabled, setAutoIncreaseEnabled] = useState(true);
  const [updatingAutoIncrease, setUpdatingAutoIncrease] = useState(false);

  useEffect(() => {
    loadUserPreferences();
  }, []);

  const loadUserPreferences = async () => {
    try {
      const user = await queryFirst<UserPreferences>(
        "SELECT * FROM user_preferences WHERE id = 1",
      );
      if (user) {
        setUserPreferences(user);
        setAutoIncreaseEnabled(user.auto_increase_enabled !== 0);
      } else {
        setUserPreferences(null);
        setAutoIncreaseEnabled(true);
      }
    } catch (e) {
      console.error("Failed to load user preferences:", e);
    }
  };

  const handleAutoIncreaseToggle = async (enabled: boolean) => {
    if (updatingAutoIncrease) {
      return;
    }

    const previousValue = autoIncreaseEnabled;

    setAutoIncreaseEnabled(enabled);
    setUpdatingAutoIncrease(true);
    setUserPreferences((previous) =>
      previous
        ? {
            ...previous,
            auto_increase_enabled: enabled ? 1 : 0,
          }
        : previous,
    );

    try {
      const existingUser = await queryFirst<{ id: number }>(
        "SELECT id FROM user_preferences WHERE id = 1",
      );

      if (existingUser) {
        await execute(
          `UPDATE user_preferences
           SET auto_increase_enabled = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = 1`,
          [enabled ? 1 : 0],
        );
      } else {
        await execute(
          `INSERT INTO user_preferences (
            id,
            username,
            yearly_book_goal,
            auto_increase_enabled,
            created_at,
            updated_at
          ) VALUES (1, 'Reader', 12, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [enabled ? 1 : 0],
        );

        setUserPreferences({
          id: 1,
          username: "Reader",
          yearly_book_goal: 12,
          auto_increase_enabled: enabled ? 1 : 0,
        });
      }
    } catch (error) {
      console.error("Failed to update auto increase setting:", error);
      setAutoIncreaseEnabled(previousValue);
      setUserPreferences((previous) =>
        previous
          ? {
              ...previous,
              auto_increase_enabled: previousValue ? 1 : 0,
            }
          : previous,
      );
      Alert.alert(
        t("settings.error"),
        t("settings.failedToUpdateAutoIncrease"),
      );
    } finally {
      setUpdatingAutoIncrease(false);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleLogout = () => {
    Alert.alert(
      t("settings.logout"),
      "Are you sure you want to log out? This will delete all your books and reading progress. This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: t("settings.logout"),
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await logoutUser();

              // Direct redirect to intro page after logout
              router.replace("/intro");
            } catch (error) {
              console.error("Logout failed:", error);
              Alert.alert("Error", "Failed to log out. Please try again.");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleExportSuccess = (filePath: string) => {
    Alert.alert(
      t("dataBackup.export.messages.exportComplete"),
      t("dataBackup.export.messages.exportCompleteMessage"),
      [{ text: "OK" }],
    );
  };

  const handleImportSuccess = (importedData: {
    books: number;
    sessions: number;
  }) => {
    Alert.alert(
      t("dataBackup.import.messages.importComplete"),
      t("dataBackup.import.messages.importSuccessMessage", {
        books: importedData.books,
        sessions: importedData.sessions,
      }),
      [
        {
          text: "OK",
          onPress: () => {
            // Reload user preferences to reflect any changes
            loadUserPreferences();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }} onTouchStart={dismissKeyboard}>
      <View style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("settings.title")}</Text>
            <Text style={styles.subtitle}>{t("settings.subtitle")}</Text>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("settings.profile")}</Text>
              <View style={styles.sectionCard}>
                <SettingsRow
                  icon="person-circle-outline"
                  title={userPreferences?.username || "-"}
                  subtitle={t("settings.goal", {
                    goal: userPreferences?.yearly_book_goal || 0,
                  })}
                  onPress={() => router.push("/(tabs)/profile")}
                />
              </View>
            </View>

            {/* Goal Automation Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("settings.goalAutomation")}
              </Text>
              <View style={styles.sectionCard}>
                <SettingsRow
                  icon="trending-up-outline"
                  title={t("settings.autoIncreaseDailyGoal")}
                  subtitle={t("settings.autoIncreaseDailyGoalDescription")}
                  onPress={() => handleAutoIncreaseToggle(!autoIncreaseEnabled)}
                  disabled={updatingAutoIncrease}
                  trailing={
                    <Switch
                      value={autoIncreaseEnabled}
                      onValueChange={handleAutoIncreaseToggle}
                      disabled={updatingAutoIncrease}
                      trackColor={{
                        false: COLORS.neutral[200],
                        true: COLORS.state.primarySoft,
                      }}
                      thumbColor={
                        autoIncreaseEnabled
                          ? COLORS.primary
                          : COLORS.neutral[400]
                      }
                    />
                  }
                  isLast
                />
              </View>
            </View>

            {/* Language Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
              <LanguageSelector />
            </View>

            {/* Notifications Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("settings.notifications")}
              </Text>
              <NotificationSettings />
            </View>

            {/* Data Backup & Restore Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("settings.dataBackup")}
              </Text>
              <View style={styles.sectionCard}>
                <SettingsRow
                  icon="download-outline"
                  title={t("dataBackup.export.title")}
                  subtitle={t("dataBackup.export.buttonSubtitle")}
                  onPress={() => setShowExportModal(true)}
                />
                <SettingsRow
                  icon="cloud-upload-outline"
                  iconColor={COLORS.success}
                  title={t("dataBackup.import.title")}
                  subtitle={t("dataBackup.import.buttonSubtitle")}
                  onPress={() => setShowImportModal(true)}
                  isLast
                />
              </View>
            </View>

            {/* App Info Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("settings.about")}</Text>
              <View style={styles.sectionCard}>
                <SettingsRow
                  icon="information-circle-outline"
                  title={t("settings.appName")}
                  subtitle={t("settings.version")}
                />
                <SettingsRow
                  icon="book-outline"
                  iconColor={COLORS.success}
                  title={t("settings.trackReading")}
                  subtitle={t("settings.builtForBookLovers")}
                  isLast
                />
              </View>
            </View>

            {/* Logout Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("settings.account")}</Text>
              <View style={styles.sectionCard}>
                <SettingsRow
                  icon="log-out-outline"
                  iconColor={COLORS.danger}
                  title={t("settings.logout")}
                  titleColor={COLORS.danger}
                  subtitle={t("settings.logoutDescription")}
                  onPress={handleLogout}
                  disabled={loading}
                  isLast
                />
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.copyright}>{t("settings.madeWithLove")}</Text>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Data Export Modal */}
      <DataExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSuccess={handleExportSuccess}
      />

      {/* Data Import Modal */}
      <DataImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface.page,
  },
  header: {
    paddingHorizontal: SPACING[4],
    marginTop: 40,
    paddingTop: SPACING[4],
    paddingBottom: SPACING[3],
    alignItems: "flex-start",
  },
  title: {
    ...TYPE.pageTitle,
    marginBottom: 2,
  },
  subtitle: {
    ...TYPE.body,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING[4],
  },
  section: {
    marginBottom: SPACING[5],
  },
  sectionTitle: {
    ...TYPE.meta,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: SPACING[2],
    paddingLeft: 4,
  },
  sectionCard: {
    backgroundColor: COLORS.surface.raised,
    borderRadius: 14,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    overflow: "hidden",
  },
  footer: {
    alignItems: "center",
    paddingVertical: SPACING[6],
    paddingBottom: 40,
  },
  copyright: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
});
