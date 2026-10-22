import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS } from "../../../themes/colors";
import { FONTS } from "../../../themes/typography";

export default function BooksLayout() {
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
          title: t("navigation.books"),
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
