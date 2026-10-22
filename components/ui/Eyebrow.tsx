import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";
import { TYPE } from "../../themes/typography";
import { toAppUpperCase } from "../../utils/format";

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
      // VoiceOver can spell out all-caps words; read the original text
      accessibilityLabel={children}
    >
      {toAppUpperCase(children)}
    </Text>
  );
}

const styles = StyleSheet.create({
  eyebrow: TYPE.eyebrow,
});
