import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { COLORS } from "../../themes/colors";

type Props = {
  /** 0–1; values outside are clamped */
  progress: number;
  color?: string;
  trackColor?: string;
  thickness?: number;
  style?: StyleProp<ViewStyle>;
};

/** A thin progress line (Folio uses rules, not chunky bars) */
export default function ProgressRule({
  progress,
  color = COLORS.accent.primary,
  trackColor = COLORS.line.hairline,
  thickness = 3,
  style,
}: Props) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View
      style={[
        styles.track,
        { height: thickness, borderRadius: thickness, backgroundColor: trackColor },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: "hidden",
  },
});
