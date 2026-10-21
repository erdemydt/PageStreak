import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { COLORS } from "../../themes/colors";
import { RADIUS, SPACING } from "../../themes/spacing";
import { FONTS } from "../../themes/typography";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

type Props = {
  title: string;
  onPress: () => void;
  /** primary: ink pill · secondary: ink outline · ghost: forest text · destructive: clay text */
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  /** Fill the remaining width in a row */
  grow?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  loading = false,
  grow = false,
  compact = false,
  style,
  accessibilityLabel,
}: Props) {
  const inactive = disabled || loading;
  const textColor = TEXT_COLOR[variant];

  const handlePress = () => {
    if (variant === "primary") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={compact ? 6 : undefined}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        CONTAINER[variant],
        grow && styles.grow,
        inactive && styles.inactive,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={16} color={textColor} />}
          <Text
            style={[styles.text, compact && styles.compactText, { color: textColor }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const TEXT_COLOR: Record<Variant, string> = {
  primary: COLORS.ink.onFill,
  secondary: COLORS.ink.primary,
  ghost: COLORS.accent.primary,
  destructive: COLORS.destructive.ink,
};

const CONTAINER: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: COLORS.ink.primary },
  secondary: {
    backgroundColor: COLORS.transparent,
    borderWidth: 1,
    borderColor: COLORS.ink.primary,
  },
  ghost: { backgroundColor: COLORS.transparent, paddingHorizontal: SPACING[2] },
  destructive: { backgroundColor: COLORS.transparent, paddingHorizontal: SPACING[2] },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: SPACING[5],
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  compact: {
    minHeight: 36,
    paddingHorizontal: SPACING[4],
  },
  grow: {
    flex: 1,
  },
  inactive: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
  },
  text: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
  },
  compactText: {
    fontSize: 14,
  },
});
