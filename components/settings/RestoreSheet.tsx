import { TFunction } from "i18next";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import {
  BackupPreview,
  hasLocalData,
  ImportMode,
  importDataFromBackup,
  pickBackupFile,
  previewBackup,
} from "../../services/dataBackupService";
import { SPACING } from "../../themes/spacing";
import { TYPE } from "../../themes/typography";
import { formatDate, LONG_DATE } from "../../utils/format";
import Button from "../ui/Button";
import Sheet from "../ui/Sheet";
import StatRow from "../ui/StatRow";

export type RestoreResult = {
  mode: ImportMode;
  books: number;
  sessions: number;
};

/**
 * Open the file picker and read the chosen backup. Returns what it holds, or
 * null if the user cancelled or the file can't be restored (they're told why).
 */
let picking = false;
export async function chooseBackup(t: TFunction): Promise<BackupPreview | null> {
  // A second tap while the picker is open is rejected by iOS, which would read as a bad file
  if (picking) return null;
  picking = true;
  try {
    const fileUri = await pickBackupFile();
    if (!fileUri) return null;
    const result = await previewBackup(fileUri);
    if ("problem" in result) {
      Alert.alert(
        t("dataBackup.import.problemTitle"),
        t(`dataBackup.import.problem.${result.problem}`),
      );
      return null;
    }
    return result.preview;
  } catch (error) {
    console.error("Choosing a backup failed:", error);
    Alert.alert(t("error"), t("dataBackup.import.problem.notBackup"));
    return null;
  } finally {
    picking = false;
  }
}

/**
 * What a chosen backup holds, and how to restore it. With nothing on this
 * device it simply restores; otherwise it offers merge (adds books and
 * sessions, keeps settings) or replace (asks first).
 */
export default function RestoreSheet({
  backup,
  onClose,
  onRestored,
}: {
  /** The chosen backup; null closes the sheet */
  backup: BackupPreview | null;
  onClose: () => void;
  onRestored: (result: RestoreResult) => void;
}) {
  const { t } = useTranslation();
  // Keep showing the backup while the sheet slides away
  const shown = useRef(backup);
  if (backup) shown.current = backup;
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!backup) return;
    let cancelled = false;
    setHasData(null);
    hasLocalData()
      .then((value) => !cancelled && setHasData(value))
      // Unsure: offer both, so nothing is replaced without asking
      .catch(() => !cancelled && setHasData(true));
    return () => {
      cancelled = true;
    };
  }, [backup]);

  const restore = async (mode: ImportMode) => {
    const current = shown.current;
    if (!current) return;
    setBusy(true);
    try {
      const result = await importDataFromBackup(current.fileUri, mode);
      if (!result.success) throw new Error(result.error);
      onRestored({ mode, ...result.imported });
    } catch (error) {
      console.error("Restore failed:", error);
      Alert.alert(t("error"), t("dataBackup.import.failed"));
    } finally {
      setBusy(false);
    }
  };

  const confirmReplace = () =>
    Alert.alert(
      t("dataBackup.import.replaceTitle"),
      t("dataBackup.import.replaceMessage"),
      [
        { text: t("settings.cancel"), style: "cancel" },
        {
          text: t("dataBackup.import.replace"),
          style: "destructive",
          onPress: () => restore("replace"),
        },
      ],
    );

  const preview = shown.current;
  const footer =
    hasData === null ? null : hasData ? (
      <>
        <Button
          title={t("dataBackup.import.replace")}
          variant="secondary"
          onPress={confirmReplace}
          disabled={busy}
        />
        <Button
          title={t("dataBackup.import.merge")}
          onPress={() => restore("merge")}
          loading={busy}
          grow
        />
      </>
    ) : (
      <Button
        title={t("dataBackup.import.restore")}
        onPress={() => restore("replace")}
        loading={busy}
        grow
      />
    );

  return (
    <Sheet
      visible={!!backup}
      onClose={onClose}
      dismissible={!busy}
      title={t("dataBackup.import.title")}
      footer={footer}
    >
      {preview && (
        <View style={styles.body}>
          <Text style={styles.meta}>
            {t("dataBackup.import.createdOn", {
              date: formatDate(preview.createdAt, LONG_DATE),
            })}
          </Text>
          <StatRow
            stats={[
              { value: preview.books, label: t("dataBackup.import.books") },
              { value: preview.sessions, label: t("dataBackup.import.sessions") },
            ]}
          />
          {preview.hasProfile && (
            <Text style={styles.meta}>{t("dataBackup.import.includesProfile")}</Text>
          )}
          {hasData && (
            <Text style={styles.bodyText}>{t("dataBackup.import.mergeExplained")}</Text>
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: SPACING[4],
    paddingBottom: SPACING[2],
  },
  meta: TYPE.meta,
  bodyText: TYPE.body,
});
