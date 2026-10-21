import { Fragment, ReactNode } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { FONTS } from "../../themes/typography";
import Hairline from "./Hairline";

export type Stat = {
  value: ReactNode;
  label: string;
  /** Forest italic value, for the stat that matters most (e.g. "Finish by") */
  emphasis?: boolean;
};

/** Two to four figures between hairlines, separated by vertical rules */
export default function StatRow({
  stats,
  style,
}: {
  stats: Stat[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.row, style]}>
      {stats.map((stat, index) => (
        <Fragment key={stat.label}>
          {index > 0 && <Hairline vertical />}
          <View style={styles.cell} accessible>
            <Text
              style={[styles.value, stat.emphasis && styles.emphasis]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {stat.value}
            </Text>
            <Text style={styles.label} numberOfLines={1}>
              {stat.label}
            </Text>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderColor: COLORS.line.hairline,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[1],
    gap: 2,
  },
  value: {
    fontFamily: FONTS.serif,
    fontSize: 23,
    lineHeight: 29,
    color: COLORS.ink.primary,
    fontVariant: ["tabular-nums"],
  },
  emphasis: {
    fontFamily: FONTS.serifItalic,
    color: COLORS.accent.primary,
  },
  label: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    letterSpacing: 0.4,
    color: COLORS.ink.secondary,
  },
});
