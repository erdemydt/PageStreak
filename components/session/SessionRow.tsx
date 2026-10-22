import { Pressable, StyleSheet, Text } from "react-native";
import { SPACING } from "../../themes/spacing";
import { TYPE } from "../../themes/typography";

/** One session in a list: a label (book or day) and its time/pages; tap to edit */
export default function SessionRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${detail}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.detail}>{detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING[3],
    minHeight: 48,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    ...TYPE.bodyStrong,
    flex: 1,
  },
  detail: {
    ...TYPE.meta,
    fontVariant: ["tabular-nums"],
  },
});
