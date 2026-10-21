import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Newsreader_400Regular } from "@expo-google-fonts/newsreader/400Regular";
import { Newsreader_400Regular_Italic } from "@expo-google-fonts/newsreader/400Regular_Italic";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader/500Medium";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, AppStateStatus, View } from "react-native";
import { LanguageProvider } from "../contexts/LanguageContext";
import "../i18n";
import { initializeDatabase } from "../db/db";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import { applyWeeklyGoalGrowth } from "../utils/goalSettings";
import ToastHost from "../components/ToastHost";

export default function RootLayout() {
  // Nothing may touch the database before migrations finish, including
  // screens opened directly by a deep link (which skip app/index.tsx)
  const [dbAttempted, setDbAttempted] = useState(false);
  // Only the weights the Folio type scale uses are bundled (themes/typography.ts)
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
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

    return () => {
      subscription?.remove();
    };
  }, []);

  // A font that fails to load falls back to the system font; don't block the app on it
  if (!dbAttempted || (!fontsLoaded && !fontError)) {
    // Brief: the native splash screen is usually still covering this
    return <View style={{ flex: 1, backgroundColor: COLORS.paper.base }} />;
  }

  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="intro"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <ToastHost />
    </LanguageProvider>
  );
}
