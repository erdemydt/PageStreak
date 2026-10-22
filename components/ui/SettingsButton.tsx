import { Ionicons } from "@expo/vector-icons";
import { router, useSegments } from "expo-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { COLORS } from "../../themes/colors";

/**
 * The gear on Today and Progress: pushes Settings inside the current tab's stack.
 * In a native header iOS 26 draws a glass circle around it; `raised` draws a
 * matching one where there's no native header (Today), so both look the same.
 */
export default function SettingsButton({ raised = false }: { raised?: boolean }) {
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
      style={({ pressed }) => [
        styles.button,
        raised && styles.raised,
        pressed && styles.pressed,
      ]}
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
  raised: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  pressed: {
    opacity: 0.5,
  },
});
