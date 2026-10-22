import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../themes/colors";
import { SPACING } from "../themes/spacing";
import { FONTS, TYPE } from "../themes/typography";
import Sheet from "./ui/Sheet";

export type BookStatus = "want_to_read" | "currently_reading" | "read";

interface BookStatusModalProps {
  visible: boolean;
  bookTitle: string;
  currentStatus: BookStatus;
  onStatusChange: (status: BookStatus) => void;
  onClose: () => void;
  /** Adds a "Delete book" row (the Library's long-press menu) */
  onDelete?: () => void;
}

const STATUS_ORDER: BookStatus[] = ["want_to_read", "currently_reading", "read"];

/** Pick a reading status (a sheet; parents only toggle `visible`) */
export default function BookStatusModal({
  visible,
  bookTitle,
  currentStatus,
  onStatusChange,
  onClose,
  onDelete,
}: BookStatusModalProps) {
  const { t } = useTranslation();

  // Keep showing the book it was opened for while it animates closed (the
  // parent may clear its selection meanwhile)
  const shown = useRef({ bookTitle, currentStatus });
  if (visible) {
    shown.current = { bookTitle, currentStatus };
  }

  const options: Record<BookStatus, { label: string; description: string }> = {
    want_to_read: {
      label: t("bookStatus.options.wantToRead.label"),
      description: t("bookStatus.options.wantToRead.description"),
    },
    currently_reading: {
      label: t("bookStatus.options.currentlyReading.label"),
      description: t("bookStatus.options.currentlyReading.description"),
    },
    read: {
      label: t("bookStatus.options.read.label"),
      description: t("bookStatus.options.read.description"),
    },
  };

  const select = (status: BookStatus) => {
    onStatusChange(status);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t("bookStatus.title")}>
      <Text style={styles.bookTitle} numberOfLines={2}>
        {shown.current.bookTitle}
      </Text>
      {STATUS_ORDER.map((status) => {
        const selected = shown.current.currentStatus === status;
        return (
          <Pressable
            key={status}
            onPress={() => select(status)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{options[status].label}</Text>
              <Text style={styles.optionDescription}>
                {options[status].description}
              </Text>
            </View>
            <Ionicons
              name={selected ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={selected ? COLORS.accent.primary : COLORS.line.strong}
            />
          </Pressable>
        );
      })}
      {onDelete && (
        <Pressable
          onPress={() => {
            onClose();
            onDelete();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.destructive.ink} />
          <Text style={styles.deleteLabel}>{t("bookPage.delete")}</Text>
        </Pressable>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bookTitle: {
    ...TYPE.byline,
    paddingBottom: SPACING[3],
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
    minHeight: 64,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
  },
  pressed: {
    opacity: 0.6,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    color: COLORS.ink.primary,
  },
  optionDescription: TYPE.meta,
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
  },
  deleteLabel: {
    ...TYPE.label,
    color: COLORS.destructive.ink,
  },
});
