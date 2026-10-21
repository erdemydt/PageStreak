import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS } from "../../../themes/colors";

// Keep the dashboard underneath when another tab navigates in (withAnchor)
export const unstable_settings = {
  initialRouteName: "index",
};

export default function HomeLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("navigation.home"),
        }}
      />

      <Stack.Screen
        name="book/[id]"
        options={{
          title: t("navigation.bookDetails"),
        }}
      />

      <Stack.Screen
        name="readinglogs"
        options={{
          title: t("components.readingLogs.title"),
        }}
      />
    </Stack>
  );
}
