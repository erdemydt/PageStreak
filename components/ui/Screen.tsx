import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../themes/colors";

/** A paper-colored page. Pass `safeTop` on screens without a navigation header. */
export default function Screen({
  children,
  safeTop = false,
  style,
}: {
  children: ReactNode;
  safeTop?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, safeTop && { paddingTop: insets.top }, style]}>
      {children}
    </View>
  );
}

/**
 * A paper band behind the status bar, for scrolling screens without a
 * navigation header: content scrolls under it instead of under the clock.
 * Render it after the ScrollView.
 */
export function StatusBarBand() {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={[styles.band, { height: insets.top }]} />;
}

const styles = StyleSheet.create({
  band: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.paper.base,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.paper.base,
  },
});
