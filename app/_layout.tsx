import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, AppStateStatus, View } from "react-native";
import { LanguageProvider } from "../contexts/LanguageContext";
import { SessionSheetsProvider } from "../contexts/SessionSheetsContext";
import "../i18n";
import { initializeDatabase } from "../db/db";
import { getUserPreferences } from "../db/repos/preferences";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import { isBootComplete } from "../utils/boot";
import { applyWeeklyGoalGrowth } from "../utils/goalSettings";
import ToastHost from "../components/ToastHost";

export default function RootLayout() {
  // Nothing may touch the database before migrations finish, including
  // screens opened directly by a deep link (which skip app/index.tsx)
  const [dbAttempted, setDbAttempted] = useState(false);
  // Only the weights the Folio type scale uses are bundled (themes/typography.ts).
  // Newsreader comes from assets/fonts: copies with a raised ascender, so iOS
  // doesn't clip the marks on capitals like İ, Ö, Ğ (scripts/fonts/patch-newsreader.py)
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular: require("../assets/fonts/Newsreader_400Regular.ttf"),
    Newsreader_400Regular_Italic: require("../assets/fonts/Newsreader_400Regular_Italic.ttf"),
    Newsreader_500Medium: require("../assets/fonts/Newsreader_500Medium.ttf"),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    initializeDatabase()
      .catch(() => {}) // app/index.tsx shows the error and offers a retry
      .finally(() => setDbAttempted(true));

    // The initial "app opened" is recorded by app/index.tsx after the
    // database is migrated; here we only forward later state changes
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      try {
        await initializeDatabase();
      } catch {
        return;
      }
      if (nextAppState === "active") {
        // A warm app may sit across a weekly goal step; apply it on resume.
        // (Cold start applies it in app/index.tsx after the DB is ready.)
        applyWeeklyGoalGrowth();
      }
      NotificationService.onAppStateChange(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // A reminder tap always lands on Today, wherever the app was left. A tap that
    // launched the app is left to app/index.tsx, which boots and lands on Today
    // itself; onboarding is never skipped (no profile, no navigation).
    const unsubscribeReminderTaps = NotificationService.onReminderTapped(
      async () => {
        if (!isBootComplete()) return;
        try {
          if (await getUserPreferences()) {
            // Pops back to Today if it's already in the stack (navigate would push a copy)
            router.dismissTo("/(tabs)/(home)");
          }
        } catch (error) {
          console.error("Error opening Today from a reminder:", error);
        }
      },
    );

    return () => {
      subscription?.remove();
      unsubscribeReminderTaps();
    };
  }, []);

  // A font that fails to load falls back to the system font; don't block the app on it
  if (!dbAttempted || (!fontsLoaded && !fontError)) {
    // Brief: the native splash screen is usually still covering this
    return <View style={{ flex: 1, backgroundColor: COLORS.paper.base }} />;
  }

  return (
    <LanguageProvider>
      <SessionSheetsProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen
            name="intro"
            options={{
              // A plain screen, not a native modal: the root-hosted sheets (Add
              // book) must be able to present over it
              headerShown: false,
              animation: "fade",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </SessionSheetsProvider>
      <ToastHost />
    </LanguageProvider>
  );
}
