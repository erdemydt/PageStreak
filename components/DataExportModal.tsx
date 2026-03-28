import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    BackupOptions,
    exportAndSaveBackup,
} from "../services/dataBackupService";
import { COLORS } from "../themes/colors";

interface DataExportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (filePath: string) => void;
}

export default function DataExportModal({
  visible,
  onClose,
  onSuccess,
}: DataExportModalProps) {
  const { t } = useTranslation();
  const [exportOptions, setExportOptions] = useState<BackupOptions>({
    includeBooks: true,
    includeReadingSessions: true,
    includeUserPreferences: true,
    includeWeeklyProgress: true,
    includeNotificationPreferences: true,
    includeAppUsage: false, // Default to false as this can be large
    compressed: false,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState("");

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportMessage(t("dataBackup.export.messages.preparing"));

    try {
      const result = await exportAndSaveBackup(
        exportOptions,
        (progress: number, message: string) => {
          setExportProgress(progress);
          setExportMessage(message);
        },
      );

      if (result.success && result.filePath) {
        if (result.userSaved) {
          // User successfully saved the file to their chosen location
          Alert.alert(
            t("dataBackup.export.messages.success"),
            t("dataBackup.export.messages.successMessage"),
            [
              {
                text: "OK",
                onPress: () => {
                  onSuccess?.(result.filePath!);
                  onClose();
                },
              },
            ],
          );
        } else {
          // File was created but user didn't save it or save was cancelled
          Alert.alert(
            t("dataBackup.export.messages.backupCreated"),
            t("dataBackup.export.messages.backupCreatedMessage"),
            [
              {
                text: "OK",
                onPress: () => {
                  onSuccess?.(result.filePath!);
                  onClose();
                },
              },
            ],
          );
        }
      } else {
        Alert.alert(
          t("dataBackup.export.messages.exportFailed"),
          result.error || t("dataBackup.export.messages.unknownError"),
        );
      }
    } catch (error) {
      Alert.alert(
        t("dataBackup.export.messages.exportFailed"),
        error instanceof Error
          ? error.message
          : t("dataBackup.export.messages.unknownError"),
      );
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportMessage("");
    }
  };

  const toggleOption = (key: keyof BackupOptions) => {
    setExportOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getEstimatedSize = () => {
    // Simple estimation based on selected options
    let estimation = t("dataBackup.export.size.small");
    const selectedCount = Object.values(exportOptions).filter(Boolean).length;

    if (selectedCount >= 4 && exportOptions.includeAppUsage) {
      estimation = t("dataBackup.export.size.large");
    } else if (selectedCount >= 3) {
      estimation = t("dataBackup.export.size.medium");
    }

    return estimation;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("dataBackup.export.title")}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("dataBackup.export.whatToExport")}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {t("dataBackup.export.subtitle")}
            </Text>

            <View style={styles.optionsList}>
              <View style={styles.option}>
                <View style={styles.optionLeft}>
                  <Ionicons name="library" size={20} color={COLORS.primary} />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>
                      {t("dataBackup.export.options.includeBooks")}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {t("dataBackup.export.options.includeBooksDescription")}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={exportOptions.includeBooks}
                  onValueChange={() => toggleOption("includeBooks")}
                  trackColor={{
                    false: COLORS.neutral[200],
                    true: COLORS.state.primarySoft,
                  }}
                  thumbColor={
                    exportOptions.includeBooks
                      ? COLORS.primary
                      : COLORS.neutral[400]
                  }
                />
              </View>

              <View style={styles.option}>
                <View style={styles.optionLeft}>
                  <Ionicons name="time" size={20} color={COLORS.success} />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>
                      {t("dataBackup.export.options.includeReadingSessions")}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {t(
                        "dataBackup.export.options.includeReadingSessionsDescription",
                      )}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={exportOptions.includeReadingSessions}
                  onValueChange={() => toggleOption("includeReadingSessions")}
                  trackColor={{
                    false: COLORS.neutral[200],
                    true: COLORS.state.primarySoft,
                  }}
                  thumbColor={
                    exportOptions.includeReadingSessions
                      ? COLORS.primary
                      : COLORS.neutral[400]
                  }
                />
              </View>

              <View style={styles.option}>
                <View style={styles.optionLeft}>
                  <Ionicons name="person" size={20} color={COLORS.warning} />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>
                      {t("dataBackup.export.options.includeUserPreferences")}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {t(
                        "dataBackup.export.options.includeUserPreferencesDescription",
                      )}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={exportOptions.includeUserPreferences}
                  onValueChange={() => toggleOption("includeUserPreferences")}
                  trackColor={{
                    false: COLORS.neutral[200],
                    true: COLORS.state.primarySoft,
                  }}
                  thumbColor={
                    exportOptions.includeUserPreferences
                      ? COLORS.primary
                      : COLORS.neutral[400]
                  }
                />
              </View>

              <View style={styles.option}>
                <View style={styles.optionLeft}>
                  <Ionicons
                    name="trending-up"
                    size={20}
                    color={COLORS.state.readingHeat4}
                  />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>
                      {t("dataBackup.export.options.includeWeeklyProgress")}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {t(
                        "dataBackup.export.options.includeWeeklyProgressDescription",
                      )}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={exportOptions.includeWeeklyProgress}
                  onValueChange={() => toggleOption("includeWeeklyProgress")}
                  trackColor={{
                    false: COLORS.neutral[200],
                    true: COLORS.state.primarySoft,
                  }}
                  thumbColor={
                    exportOptions.includeWeeklyProgress
                      ? COLORS.primary
                      : COLORS.neutral[400]
                  }
                />
              </View>

              <View style={styles.option}>
                <View style={styles.optionLeft}>
                  <Ionicons
                    name="notifications"
                    size={20}
                    color={COLORS.danger}
                  />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>
                      {t(
                        "dataBackup.export.options.includeNotificationPreferences",
                      )}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {t(
                        "dataBackup.export.options.includeNotificationPreferencesDescription",
                      )}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={exportOptions.includeNotificationPreferences}
                  onValueChange={() =>
                    toggleOption("includeNotificationPreferences")
                  }
                  trackColor={{
                    false: COLORS.neutral[200],
                    true: COLORS.state.primarySoft,
                  }}
                  thumbColor={
                    exportOptions.includeNotificationPreferences
                      ? COLORS.primary
                      : COLORS.neutral[400]
                  }
                />
              </View>

              <View style={styles.option}>
                <View style={styles.optionLeft}>
                  <Ionicons
                    name="analytics"
                    size={20}
                    color={COLORS.neutral[500]}
                  />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>
                      {t("dataBackup.export.options.includeAppUsage")}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {t(
                        "dataBackup.export.options.includeAppUsageDescription",
                      )}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={exportOptions.includeAppUsage}
                  onValueChange={() => toggleOption("includeAppUsage")}
                  trackColor={{
                    false: COLORS.neutral[200],
                    true: COLORS.state.primarySoft,
                  }}
                  thumbColor={
                    exportOptions.includeAppUsage
                      ? COLORS.primary
                      : COLORS.neutral[400]
                  }
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("dataBackup.export.exportInformation")}
            </Text>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t("dataBackup.export.estimatedSize")}
                </Text>
                <Text style={styles.infoValue}>{getEstimatedSize()}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t("dataBackup.export.format")}
                </Text>
                <Text style={styles.infoValue}>JSON</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t("dataBackup.export.compatibility")}
                </Text>
                <Text style={styles.infoValue}>PageStreak v1.0+</Text>
              </View>
            </View>

            <View style={styles.warningCard}>
              <Ionicons
                name="information-circle"
                size={20}
                color={COLORS.warning}
              />
              <Text style={styles.warningText}>
                {t("dataBackup.export.messages.warning")}
              </Text>
            </View>
          </View>

          {isExporting && (
            <View style={styles.progressSection}>
              <Text style={styles.progressTitle}>
                {t("dataBackup.export.exportingData")}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${exportProgress}%` }]}
                />
              </View>
              <Text style={styles.progressText}>{exportMessage}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
            disabled={isExporting}
          >
            <Text style={styles.cancelButtonText}>
              {t("dataBackup.export.buttons.cancel")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.exportButton,
              isExporting && styles.disabledButton,
            ]}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Ionicons name="download" size={20} color={COLORS.white} />
                <Text style={styles.exportButtonText}>
                  {t("dataBackup.export.exportAndSave")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.neutral[800],
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[700],
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.neutral[500],
    marginBottom: 16,
  },
  optionsList: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[100],
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionText: {
    marginLeft: 12,
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.neutral[800],
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: COLORS.neutral[500],
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.neutral[800],
    fontWeight: "600",
  },
  warningCard: {
    backgroundColor: COLORS.state.warningSoft,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  warningText: {
    fontSize: 14,
    color: COLORS.state.warningText,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  progressSection: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    alignItems: "center",
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[700],
    marginBottom: 16,
  },
  progressBar: {
    width: "100%",
    height: 6,
    backgroundColor: COLORS.neutral[200],
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.neutral[500],
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral[200],
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  cancelButton: {
    backgroundColor: COLORS.neutral[100],
    borderWidth: 1,
    borderColor: COLORS.neutral[300],
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[500],
  },
  exportButton: {
    backgroundColor: COLORS.primary,
    gap: 8,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  disabledButton: {
    backgroundColor: COLORS.neutral[400],
  },
});
