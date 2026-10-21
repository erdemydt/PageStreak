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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.paper.base,
  },
});
