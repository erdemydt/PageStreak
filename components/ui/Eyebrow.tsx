import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";
import { TYPE } from "../../themes/typography";

/** Small uppercase label above a section ("CURRENTLY READING") */
export default function Eyebrow({
  children,
  color,
  style,
}: {
  children: string;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[styles.eyebrow, color ? { color } : null, style]}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  eyebrow: TYPE.eyebrow,
});
