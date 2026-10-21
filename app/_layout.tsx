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

  if (!dbAttempted) {
    // Brief: the native splash screen is usually still covering this
    return <View style={{ flex: 1, backgroundColor: COLORS.neutral[50] }} />;
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
