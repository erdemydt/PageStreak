import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import SettingsButton from "../../../components/ui/SettingsButton";
import { COLORS } from "../../../themes/colors";
import { FONTS } from "../../../themes/typography";

export default function ProgressLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.paper.base },
        headerTintColor: COLORS.ink.primary,
        headerTitleStyle: { fontFamily: FONTS.serif, fontSize: 19 },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("navigation.progress"),
          headerRight: () => <SettingsButton />,
        }}
      />
      <Stack.Screen name="growth" options={{ title: t("growthJourney.title") }} />
      <Stack.Screen name="history" options={{ title: t("history.title") }} />
    </Stack>
  );
}
