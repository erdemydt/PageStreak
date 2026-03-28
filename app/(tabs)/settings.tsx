import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Keyboard,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import DataExportModal from "../../components/DataExportModal";
import DataImportModal from "../../components/DataImportModal";
import LanguageSelector from "../../components/LanguageSelector";
import NotificationSettings from "../../components/NotificationSettings";
import NotificationTester from "../../components/NotificationTester";
import { queryFirst } from "../../db/db";
import { COLORS } from "../../themes/colors";
import { isDevModeEnabled } from "../../utils/devMode";
import { logoutUser } from "../../utils/migration";

type UserPreferences = {
  id: number;
  username: string;
  yearly_book_goal: number;
  preferred_genres?: string;
  created_at?: string;
  updated_at?: string;
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

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
      }
    } catch (e) {
      console.error("Failed to load user preferences:", e);
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
              <View style={styles.profileCard}>
                <TouchableOpacity
                  style={styles.profileNavigationButton}
                  onPress={() => router.push("/(tabs)/profile")}
                >
                  <View style={styles.profileHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {userPreferences?.username.charAt(0).toUpperCase() ||
                          "?"}
                      </Text>
                    </View>
                    <View style={styles.profileInfo}>
                      <Text style={styles.profileName}>
                        {userPreferences?.username || "Loading..."}
                      </Text>
                      <Text style={styles.profileGoal}>
                        {t("settings.goal", {
                          goal: userPreferences?.yearly_book_goal || 0,
                        })}
                      </Text>
                      <Text style={styles.profileSubtext}>
                        {t("settings.editProfile")}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                </TouchableOpacity>
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
              <View style={styles.backupCard}>
                <TouchableOpacity
                  style={styles.backupOption}
                  onPress={() => setShowExportModal(true)}
                >
                  <View style={styles.backupOptionLeft}>
                    <Ionicons
                      name="download"
                      size={24}
                      color={COLORS.primary}
                    />
                    <View style={styles.backupOptionInfo}>
                      <Text style={styles.backupOptionTitle}>
                        {t("dataBackup.export.title")}
                      </Text>
                      <Text style={styles.backupOptionSubtitle}>
                        {t("dataBackup.export.buttonSubtitle")}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                  style={styles.backupOption}
                  onPress={() => setShowImportModal(true)}
                >
                  <View style={styles.backupOptionLeft}>
                    <Ionicons
                      name="cloud-upload"
                      size={24}
                      color={COLORS.success}
                    />
                    <View style={styles.backupOptionInfo}>
                      <Text style={styles.backupOptionTitle}>
                        {t("dataBackup.import.title")}
                      </Text>
                      <Text style={styles.backupOptionSubtitle}>
                        {t("dataBackup.import.buttonSubtitle")}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.success}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* App Info Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("settings.about")}</Text>
              <View style={styles.aboutCard}>
                <View style={styles.aboutItem}>
                  <Ionicons
                    name="information-circle-outline"
                    size={24}
                    color={COLORS.primary}
                  />
                  <View style={styles.aboutInfo}>
                    <Text style={styles.aboutTitle}>
                      {t("settings.appName")}
                    </Text>
                    <Text style={styles.aboutSubtitle}>
                      {t("settings.version")}
                    </Text>
                  </View>
                </View>
                <View style={styles.aboutItem}>
                  <Ionicons
                    name="book-outline"
                    size={24}
                    color={COLORS.success}
                  />
                  <View style={styles.aboutInfo}>
                    <Text style={styles.aboutTitle}>
                      {t("settings.trackReading")}
                    </Text>
                    <Text style={styles.aboutSubtitle}>
                      {t("settings.builtForBookLovers")}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Logout Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("settings.account")}</Text>
              <View style={styles.logoutCard}>
                <TouchableOpacity
                  style={styles.logoutBtn}
                  onPress={handleLogout}
                  disabled={loading}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={24}
                    color={COLORS.danger}
                  />
                  <View style={styles.logoutInfo}>
                    <Text style={styles.logoutTitle}>
                      {t("settings.logout")}
                    </Text>
                    <Text style={styles.logoutSubtitle}>
                      {t("settings.logoutDescription")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.danger}
                  />
                </TouchableOpacity>
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
    backgroundColor: COLORS.neutral[50],
  },
  header: {
    paddingHorizontal: 24,
    marginTop: 40,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.neutral[800],
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.neutral[500],
    textAlign: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.neutral[700],
    marginBottom: 16,
    paddingLeft: 4,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  profileNavigationButton: {
    padding: 20,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileSubtext: {
    fontSize: 12,
    color: COLORS.neutral[400],
    fontStyle: "italic",
    marginTop: 4,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "bold",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.neutral[800],
    marginBottom: 4,
  },
  profileGoal: {
    fontSize: 14,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  editBtn: {
    backgroundColor: COLORS.neutral[100],
    padding: 12,
    borderRadius: 10,
  },
  aboutCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  aboutItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  aboutInfo: {
    marginLeft: 16,
    flex: 1,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 2,
  },
  aboutSubtitle: {
    fontSize: 14,
    color: COLORS.neutral[500],
  },
  footer: {
    alignItems: "center",
    paddingVertical: 32,
    paddingBottom: 40,
  },
  copyright: {
    fontSize: 12,
    color: COLORS.neutral[400],
  },
  logoutCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  logoutInfo: {
    marginLeft: 16,
    flex: 1,
  },
  logoutTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.danger,
    marginBottom: 2,
  },
  logoutSubtitle: {
    fontSize: 14,
    color: COLORS.neutral[400],
  },
  backupCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  backupOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  backupOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backupOptionInfo: {
    marginLeft: 16,
    flex: 1,
  },
  backupOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 2,
  },
  backupOptionSubtitle: {
    fontSize: 14,
    color: COLORS.neutral[500],
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.neutral[100],
    marginHorizontal: 20,
  },
});
