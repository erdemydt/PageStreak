import { Ionicons } from "@expo/vector-icons";
import { router, useSegments } from "expo-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { COLORS } from "../../themes/colors";

/** The gear on Today and Progress: pushes Settings inside the current tab's stack */
export default function SettingsButton() {
  const { t } = useTranslation();
  const segments = useSegments();
  const inProgress = (segments as string[]).includes("(progress)");
  // push always adds a screen: a quick double tap would open Settings twice
  const lastPress = useRef(0);
  const open = () => {
    const now = Date.now();
    if (now - lastPress.current < 1000) return;
    lastPress.current = now;
    // Both tabs have a /settings route: name the group so the push stays in this tab
    router.push(
      inProgress ? "/(tabs)/(progress)/settings" : "/(tabs)/(home)/settings",
    );
  };
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={t("navigation.settings")}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="settings-outline" size={22} color={COLORS.ink.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.5,
  },
});
