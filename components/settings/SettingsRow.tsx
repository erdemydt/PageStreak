import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { TYPE } from "../../themes/typography";

/**
 * One Settings line: a label, an optional value on the right and a chevron
 * when it opens something. Rows are separated by hairlines, not cards.
 */
export default function SettingsRow({
  label,
  value,
  hint,
  trailing,
  onPress,
  icon = "chevron-forward",
  destructive = false,
  selected,
  disabled = false,
  first = false,
  accessibilityHint,
}: {
  label: string;
  value?: string;
  hint?: string;
  /** Replaces the value and chevron (e.g. a Switch) */
  trailing?: ReactNode;
  onPress?: () => void;
  /** The trailing icon on pressable rows ("open-outline" for links that leave the app) */
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  /** Makes the row one choice of several (a radio): a checkmark when selected */
  selected?: boolean;
  disabled?: boolean;
  /** No hairline above the first row under a section label */
  first?: boolean;
  accessibilityHint?: string;
}) {
  const content = (
    <>
      <View style={styles.text}>
        <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {selected !== undefined ? (
        selected ? (
          <Ionicons name="checkmark" size={20} color={COLORS.accent.primary} />
        ) : null
      ) : trailing ?? (
        <>
          {value ? (
            <Text style={styles.value} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {onPress && !destructive ? (
            <Ionicons name={icon} size={icon === "chevron-forward" ? 18 : 16} color={COLORS.ink.tertiary} />
          ) : null}
        </>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[styles.row, !first && styles.divider]}
        accessible={!trailing}
        accessibilityLabel={value ? `${label}, ${value}` : undefined}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={selected !== undefined ? "radio" : "button"}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={
        selected !== undefined ? { disabled, checked: selected } : { disabled }
      }
      style={({ pressed }) => [
        styles.row,
        !first && styles.divider,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: SPACING[3],
    gap: SPACING[3],
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: TYPE.label,
  destructive: {
    color: COLORS.destructive.ink,
  },
  hint: TYPE.meta,
  value: {
    ...TYPE.meta,
    flexShrink: 1,
    color: COLORS.ink.secondary,
  },
});
