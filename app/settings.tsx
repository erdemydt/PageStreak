import * as Application from "expo-application";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import DataExportModal from "../components/DataExportModal";
import DataImportModal from "../components/DataImportModal";
import NotificationTester from "../components/NotificationTester";
import ReminderSettings from "../components/settings/ReminderSettings";
import SettingsRow from "../components/settings/SettingsRow";
import Eyebrow from "../components/ui/Eyebrow";
import FieldSheet from "../components/ui/FieldSheet";
import OptionSheet from "../components/ui/OptionSheet";
import Screen from "../components/ui/Screen";
import { useLanguage } from "../contexts/LanguageContext";
import { getUserPreferences, updateUsername } from "../db/repos/preferences";
import { useFocusRefresh } from "../hooks/useFocusRefresh";
import { SPACING } from "../themes/spacing";
import { FONTS, TYPE } from "../themes/typography";
import type { UserPreferences } from "../types/models";
import { isDevModeEnabled } from "../utils/devMode";
import { logoutUser } from "../utils/migration";

// Language names are shown in their own language
const LANGUAGES = [
  { key: "en", label: "English" },
  { key: "tr", label: "Türkçe" },
] as const;
type LanguageCode = (typeof LANGUAGES)[number]["key"];

// From the native bundle (Info.plist), not app.json
const VERSION = [
  Application.nativeApplicationVersion,
  Application.nativeBuildVersion && `(${Application.nativeBuildVersion})`,
]
  .filter(Boolean)
  .join(" ");

/**
 * Opened from the gear on Today and Progress. Goals live in Progress; here
 * are the name, language, the reminder, backups and erasing everything.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useLanguage();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [erasing, setErasing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [pickingLanguage, setPickingLanguage] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = async () => {
    try {
      setPrefs(await getUserPreferences());
    } catch (error) {
      console.error("Failed to load user preferences:", error);
    }
  };
  useFocusRefresh(load, ["preferences"]);

  const saveName = async (value: string) => {
    const name = value.trim();
    // Same rule as onboarding
    if (name.length < 2 || name.length > 50) return t("settings.nameRequired");
    await updateUsername(name);
  };

  const confirmErase = () => {
    Alert.alert(t("settings.logout"), t("settings.logoutConfirmMessage"), [
      { text: t("settings.cancel"), style: "cancel" },
      {
        // Erasing can't be undone; offer a backup right from the warning
        text: t("settings.exportFirst"),
        onPress: () => setShowExport(true),
      },
      {
        text: t("settings.logout"),
        style: "destructive",
        onPress: async () => {
          try {
            setErasing(true);
            await logoutUser();
            // Drop Settings and the tabs so onboarding starts from a clean stack
            router.dismissAll();
            router.replace("/intro");
          } catch (error) {
            console.error("Erase failed:", error);
            Alert.alert(t("settings.error"), t("settings.logoutFailed"));
          } finally {
            setErasing(false);
          }
        },
      },
    ]);
  };

  const languageLabel =
    LANGUAGES.find((language) => language.key === currentLanguage)?.label ?? "";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Eyebrow>{t("settings.you")}</Eyebrow>
          <SettingsRow
            first
            label={t("settings.name")}
            value={prefs?.username || undefined}
            onPress={() => setEditingName(true)}
            disabled={!prefs}
            accessibilityHint={t("settings.editName")}
          />
          <SettingsRow
            label={t("settings.language")}
            value={languageLabel}
            onPress={() => setPickingLanguage(true)}
          />
        </View>

        <View style={styles.section}>
          <Eyebrow>{t("settings.reminders")}</Eyebrow>
          <ReminderSettings />
        </View>

        {isDevModeEnabled() && (
          <View style={styles.section}>
            <Eyebrow>Development</Eyebrow>
            <NotificationTester />
          </View>
        )}

        <View style={styles.section}>
          <Eyebrow>{t("settings.dataBackup")}</Eyebrow>
          <SettingsRow
            first
            label={t("settings.exportBackup")}
            hint={t("dataBackup.export.buttonSubtitle")}
            onPress={() => setShowExport(true)}
          />
          <SettingsRow
            label={t("settings.restoreBackup")}
            hint={t("dataBackup.import.buttonSubtitle")}
            onPress={() => setShowImport(true)}
          />
        </View>

        <View style={styles.section}>
          <Eyebrow>{t("settings.about")}</Eyebrow>
          {VERSION ? (
            <SettingsRow first label={t("settings.version")} value={VERSION} />
          ) : null}
          <SettingsRow
            first={!VERSION}
            label={t("settings.bookData")}
            value="Open Library"
            icon="open-outline"
            onPress={() => Linking.openURL("https://openlibrary.org")}
          />
        </View>

        <View style={styles.section}>
          <SettingsRow
            first
            label={t("settings.logout")}
            hint={t("settings.logoutDescription")}
            onPress={confirmErase}
            disabled={erasing}
            destructive
          />
        </View>

        <Text style={styles.colophon}>{t("settings.madeWithLove")}</Text>
      </ScrollView>

      <FieldSheet
        visible={editingName}
        title={t("settings.nameTitle")}
        initialValue={prefs?.username || ""}
        maxLength={50}
        onSave={saveName}
        onClose={() => setEditingName(false)}
      />
      <OptionSheet<LanguageCode>
        visible={pickingLanguage}
        title={t("settings.language")}
        options={LANGUAGES.map((language) => ({ ...language }))}
        selected={currentLanguage as LanguageCode}
        onSelect={(code) => {
          changeLanguage(code).catch((error) =>
            console.error("Failed to change language:", error),
          );
        }}
        onClose={() => setPickingLanguage(false)}
      />
      <DataExportModal visible={showExport} onClose={() => setShowExport(false)} />
      <DataImportModal visible={showImport} onClose={() => setShowImport(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[3],
    paddingBottom: SPACING[8],
    gap: SPACING[6],
  },
  section: {
    gap: SPACING[1],
  },
  colophon: {
    ...TYPE.meta,
    fontFamily: FONTS.serifItalic,
    textAlign: "center",
  },
});
