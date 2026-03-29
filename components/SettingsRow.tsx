import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../themes/colors";
import { SPACING } from "../themes/spacing";

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  iconColor?: string;
  titleColor?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  isLast?: boolean;
}

export default function SettingsRow({
  icon,
  title,
  subtitle,
  iconColor = COLORS.accent.primary,
  titleColor = COLORS.text.primary,
  trailing,
  onPress,
  disabled = false,
  isLast = false,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={onPress && !disabled ? 0.75 : 1}
      onPress={onPress}
      disabled={!onPress || disabled}
      style={[styles.row, isLast && styles.rowLast]}
    >
      <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />
      <View style={styles.info}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing || (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.neutral[400]}
          style={styles.chevron}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[3],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[100],
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  icon: {
    marginRight: SPACING[3],
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  chevron: {
    marginLeft: SPACING[2],
  },
});
