import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import { COLORS } from "../../themes/colors";
import { RADIUS, SPACING } from "../../themes/spacing";
import { FONTS } from "../../themes/typography";

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Share the row's width equally */
  grow?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A choice pill: hairline outline, ink fill when selected */
export default function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
  grow = false,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        grow && styles.grow,
        disabled && styles.disabled,
        pressed && !selected && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[styles.label, selected && styles.selectedLabel]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: SPACING[4],
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.line.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: {
    backgroundColor: COLORS.ink.primary,
    borderColor: COLORS.ink.primary,
  },
  grow: {
    flex: 1,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    backgroundColor: COLORS.paper.sunken,
  },
  label: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: COLORS.ink.primary,
  },
  selectedLabel: {
    color: COLORS.ink.onFill,
  },
});
