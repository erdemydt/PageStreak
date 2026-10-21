import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DataExportModal from "../../components/DataExportModal";
import DataImportModal from "../../components/DataImportModal";
import LanguageSelector from "../../components/LanguageSelector";
import NotificationSettings from "../../components/NotificationSettings";
import NotificationTester from "../../components/NotificationTester";
import SettingsRow from "../../components/SettingsRow";
import { getUserPreferences } from "../../db/repos/preferences";
import type { UserPreferences } from "../../types/models";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { TYPE } from "../../themes/typography";
import { isDevModeEnabled } from "../../utils/devMode";
import { logoutUser } from "../../utils/migration";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const loadUserPreferences = async () => {
    try {
      const user = await getUserPreferences();
      if (user) {
        setUserPreferences(user);
      }
    } catch (e) {
      console.error("Failed to load user preferences:", e);
    }
  };
  useFocusRefresh(loadUserPreferences, ["preferences"]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleLogout = () => {
    Alert.alert(t("settings.logout"), t("settings.logoutConfirmMessage"), [
      {
        text: t("settings.cancel"),
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
            Alert.alert(t("settings.error"), t("settings.logoutFailed"));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
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

            {/* Development Notification Tester - Only show in development */}
            {isDevModeEnabled() && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🧪 Development Tools</Text>
                <NotificationTester />
              </View>
            )}

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
