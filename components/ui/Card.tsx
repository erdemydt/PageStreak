import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { COLORS } from "../../themes/colors";
import { RADIUS, SPACING } from "../../themes/spacing";

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface.raised,
    marginHorizontal: SPACING[4],
    marginBottom: SPACING[3],
    padding: SPACING[4],
    borderRadius: RADIUS.lg,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
});
