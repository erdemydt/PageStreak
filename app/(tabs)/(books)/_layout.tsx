import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS } from "../../../themes/colors";

// When another tab navigates into this stack (with withAnchor), keep the
// library index underneath so Back and the tab button lead somewhere
export const unstable_settings = {
  initialRouteName: "index",
};

export default function BooksLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.surface.page,
        },
        headerTintColor: COLORS.text.primary,
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("navigation.books"),
        }}
      />
      <Stack.Screen
        name="search"
        options={{
          title: t("navigation.searchBooks"),
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="my-books"
        options={{
          title: t("navigation.myBooks"),
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t("navigation.bookDetails"),
          presentation: "card",
        }}
      />
    </Stack>
  );
}
