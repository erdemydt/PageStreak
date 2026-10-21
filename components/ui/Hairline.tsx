import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { COLORS } from "../../themes/colors";

/** Folio separates sections with hairlines instead of cards */
export default function Hairline({
  vertical = false,
  style,
}: {
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[vertical ? styles.vertical : styles.horizontal, style]} />;
}

const styles = StyleSheet.create({
  horizontal: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: COLORS.line.hairline,
  },
  vertical: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: "stretch",
    backgroundColor: COLORS.line.hairline,
  },
});
