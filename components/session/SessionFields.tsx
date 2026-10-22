import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { COLORS } from "../../themes/colors";
import { RADIUS, SPACING } from "../../themes/spacing";
import { FONTS, TYPE } from "../../themes/typography";
import { toAppUpperCase } from "../../utils/format";
import Chip from "../ui/Chip";

/**
 * The form fields shared by the log sheet (ReadingTimeLogger) and the edit
 * sheet (EditSessionModal), so both look and validate the same way.
 */

export function FieldGroup({
  label,
  optional = false,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text
          style={styles.label}
          accessibilityRole="header"
          // VoiceOver can spell out all-caps words; read the original text
          accessibilityLabel={label}
        >
          {toAppUpperCase(label)}
        </Text>
        {optional && (
          <Text style={styles.optional}>
            {t("components.readingTimeLogger.optional")}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

const QUICK_MINUTES = [10, 15, 20, 30, 45, 60];

export function MinutesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (minutes: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <FieldGroup label={t("components.readingTimeLogger.howManyMinutes")}>
      <View style={styles.bigInputRow}>
        <TextInput
          style={styles.bigInput}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={COLORS.ink.disabled}
          maxLength={4}
          accessibilityLabel={t("components.readingTimeLogger.minutes")}
        />
        <Text style={styles.unit}>{t("components.readingTimeLogger.minutes")}</Text>
      </View>
      <View style={styles.chipWrap}>
        {QUICK_MINUTES.map((minutes) => (
          <Chip
            key={minutes}
            label={String(minutes)}
            selected={value === String(minutes)}
            onPress={() => onChange(String(minutes))}
            style={styles.quickChip}
          />
        ))}
      </View>
    </FieldGroup>
  );
}

const QUICK_PAGES = [5, 10, 20, 30];

export function PagesField({
  value,
  onChange,
  remaining,
  total,
  enabled,
  disabledHint,
}: {
  value: string;
  onChange: (pages: string) => void;
  /** Pages this session can still add (an edited session's own pages count as free) */
  remaining: number;
  /** The book's page count; leave it out when no book is chosen */
  total?: number;
  enabled: boolean;
  disabledHint?: string;
}) {
  const { t } = useTranslation();
  const entered = Number(value);
  const hasValue = value.trim() !== "" && !Number.isNaN(entered) && entered > 0;
  const tooMany = hasValue && entered > remaining;
  // One line that follows the typing: "Page 20 of 608"
  const startPage = total ? total - remaining : 0;
  const pageLine = !total
    ? null
    : hasValue || startPage > 0
      ? t("components.readingTimeLogger.pageOfTotal", {
          page: startPage + (hasValue && !tooMany ? entered : 0),
          total,
        })
      : t("components.readingTimeLogger.totalPages", { total });

  return (
    <FieldGroup label={t("components.readingTimeLogger.pagesRead")} optional>
      {pageLine ? (
        <Text style={[styles.meta, hasValue && !tooMany && styles.preview]}>
          {pageLine}
        </Text>
      ) : null}
      {enabled && remaining > 0 && (
        <View style={styles.chipWrap}>
          {QUICK_PAGES.filter((pages) => pages <= remaining).map((pages) => (
            <Chip
              key={pages}
              label={String(pages)}
              selected={value === String(pages)}
              onPress={() => onChange(String(pages))}
              style={styles.quickChip}
            />
          ))}
        </View>
      )}
      <View style={[styles.inlineInput, !enabled && styles.inputDisabled]}>
        <TextInput
          style={styles.inlineInputText}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          editable={enabled}
          placeholder={enabled ? undefined : disabledHint}
          placeholderTextColor={COLORS.ink.disabled}
          maxLength={5}
          accessibilityLabel={t("components.readingTimeLogger.pagesRead")}
        />
        {value.trim() !== "" && (
          <Pressable
            onPress={() => onChange("")}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.clearPages")}
            hitSlop={10}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.ink.tertiary} />
          </Pressable>
        )}
      </View>
      {tooMany ? (
        <Text style={styles.warning}>
          {t("components.readingTimeLogger.tooManyPagesWarning", { remaining })}
        </Text>
      ) : null}
    </FieldGroup>
  );
}

export function NotesField({
  value,
  onChange,
  label,
  placeholder,
  onFocus,
}: {
  value: string;
  onChange: (notes: string) => void;
  label: string;
  placeholder: string;
  onFocus?: () => void;
}) {
  return (
    <FieldGroup label={label}>
      <TextInput
        style={styles.notes}
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={COLORS.ink.disabled}
        multiline
        textAlignVertical="top"
        accessibilityLabel={label}
      />
    </FieldGroup>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: SPACING[3],
    paddingVertical: SPACING[4],
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  label: TYPE.eyebrow,
  optional: {
    ...TYPE.meta,
    fontFamily: FONTS.serifItalic,
  },
  bigInputRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: SPACING[2],
  },
  bigInput: {
    fontFamily: FONTS.serif,
    fontSize: 52,
    lineHeight: 60,
    minWidth: 70,
    color: COLORS.ink.primary,
    paddingVertical: 0,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    ...TYPE.byline,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING[2],
  },
  quickChip: {
    minWidth: 52,
  },
  meta: TYPE.meta,
  inlineInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
    minHeight: 48,
    paddingHorizontal: SPACING[4],
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line.strong,
    backgroundColor: COLORS.paper.raised,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inlineInputText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 16,
    color: COLORS.ink.primary,
    paddingVertical: SPACING[3],
  },
  preview: {
    ...TYPE.meta,
    color: COLORS.accent.primary,
  },
  warning: {
    ...TYPE.meta,
    color: COLORS.destructive.ink,
  },
  notes: {
    minHeight: 88,
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[3],
    paddingBottom: SPACING[3],
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line.strong,
    backgroundColor: COLORS.paper.raised,
    fontFamily: FONTS.sans,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.ink.primary,
  },
});
