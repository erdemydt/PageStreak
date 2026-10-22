import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EnhancedBook } from "../../db/db";
import { deleteBookWithSessions, setPageCount } from "../../db/repos/books";
import { COLORS } from "../../themes/colors";
import { RADIUS, SPACING } from "../../themes/spacing";
import { FONTS, TYPE } from "../../themes/typography";
import { showToast } from "../../utils/toast";
import Button from "../ui/Button";
import Sheet from "../ui/Sheet";

type Mode = "menu" | "pages";

/** The book page's "…" menu: edit the page count, delete the book */
export default function BookMenuSheet({
  book,
  visible,
  initialMode = "menu",
  onClose,
  onDeleting,
  onDeleted,
}: {
  book: EnhancedBook;
  visible: boolean;
  /** "pages" opens straight on the page-count form */
  initialMode?: Mode;
  onClose: () => void;
  /** True right before the delete runs (false if it fails) */
  onDeleting?: (active: boolean) => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("menu");
  const [pagesInput, setPagesInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    if (initialMode === "pages") {
      setPagesInput(book.page > 0 ? String(book.page) : "");
    }
    // Only when it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const editPages = () => {
    setPagesInput(book.page > 0 ? String(book.page) : "");
    setMode("pages");
  };

  const savePages = async () => {
    const pages = Number(pagesInput);
    if (!Number.isInteger(pages) || pages <= 0) {
      Alert.alert(t("error"), t("components.bookDetailModal.invalidPageCount"));
      return;
    }
    setBusy(true);
    try {
      await setPageCount(book.id, pages);
      onClose();
    } catch (error) {
      console.error("Failed to update page count:", error);
      Alert.alert(t("error"), t("booksPage.failedToSave"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      t("booksPage.alert.deleteTitle"),
      t("booksPage.alert.deleteWithSessionsMessage", { title: book.name }),
      [
        { text: t("booksPage.alert.cancel"), style: "cancel" },
        {
          text: t("booksPage.alert.delete"),
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            onDeleting?.(true);
            try {
              await deleteBookWithSessions(book.id);
              onClose();
              onDeleted();
              showToast({
                message: t("bookPage.deleted", { title: book.name }),
              });
            } catch (error) {
              console.error("Delete book error:", error);
              onDeleting?.(false);
              Alert.alert(t("error"), t("booksPage.alert.failedDelete"));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={!busy}
      title={mode === "pages" ? t("bookPage.pageCount") : undefined}
      footer={
        mode === "pages" ? (
          <>
            <Button
              title={t("components.bookDetailModal.cancel")}
              variant="secondary"
              onPress={() =>
                initialMode === "pages" ? onClose() : setMode("menu")
              }
              disabled={busy}
            />
            <Button
              title={t("components.bookDetailModal.save")}
              onPress={savePages}
              loading={busy}
              grow
            />
          </>
        ) : undefined
      }
    >
      {mode === "menu" ? (
        <View>
          <MenuRow
            icon="document-text-outline"
            label={t("bookPage.editPageCount")}
            detail={
              book.page > 0
                ? book.page === 1
                  ? t("bookPage.pagesValueOne")
                  : t("bookPage.pagesValue", { count: book.page })
                : t("bookPage.pagesUnknown")
            }
            onPress={editPages}
          />
          <MenuRow
            icon="trash-outline"
            label={t("bookPage.delete")}
            destructive
            onPress={confirmDelete}
          />
        </View>
      ) : (
        <View style={styles.pagesForm}>
          <Text style={styles.hint}>{t("bookPage.pageCountHint")}</Text>
          <TextInput
            style={styles.pagesInput}
            value={pagesInput}
            onChangeText={setPagesInput}
            keyboardType="number-pad"
            placeholder={t("components.bookDetailModal.pageCountPlaceholder")}
            placeholderTextColor={COLORS.ink.disabled}
            autoFocus
            maxLength={5}
            onSubmitEditing={savePages}
            accessibilityLabel={t("bookPage.pageCount")}
          />
        </View>
      )}
    </Sheet>
  );
}

function MenuRow({
  icon,
  label,
  detail,
  destructive = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  const color = destructive ? COLORS.destructive.ink : COLORS.ink.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: COLORS.line.hairline,
  },
  pressed: {
    opacity: 0.6,
  },
  rowLabel: {
    ...TYPE.label,
    flex: 1,
  },
  rowDetail: TYPE.meta,
  pagesForm: {
    gap: SPACING[3],
  },
  hint: TYPE.meta,
  pagesInput: {
    fontFamily: FONTS.serif,
    fontSize: 40,
    lineHeight: 48,
    color: COLORS.ink.primary,
    paddingVertical: SPACING[2],
    paddingHorizontal: SPACING[4],
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line.strong,
    backgroundColor: COLORS.paper.raised,
    fontVariant: ["tabular-nums"],
  },
});
