import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Pressable, Text } from "react-native";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { FONTS } from "../../themes/typography";
import Sheet from "./Sheet";

export type Option<K extends string> = { key: K; label: string };

/** Pick one of a few options (e.g. a sort order); closes on selection */
export default function OptionSheet<K extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option<K>[];
  selected: K;
  onSelect: (key: K) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {options.map((option) => {
        const isSelected = option.key === selected;
        return (
          <Pressable
            key={option.key}
            onPress={() => {
              onSelect(option.key);
              onClose();
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.label}>{option.label}</Text>
            {isSelected && (
              <Ionicons name="checkmark" size={22} color={COLORS.accent.primary} />
            )}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
    gap: SPACING[3],
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    color: COLORS.ink.primary,
  },
});
