import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS } from "../../../themes/colors";
import { FONTS } from "../../../themes/typography";

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
          backgroundColor: COLORS.paper.base,
        },
        headerTintColor: COLORS.ink.primary,
        headerTitleStyle: {
          fontFamily: FONTS.serif,
          fontSize: 19,
        },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("navigation.home"),
          // Today draws its own Folio header
          headerShown: false,
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
          title: t("history.title"),
        }}
      />
    </Stack>
  );
}
