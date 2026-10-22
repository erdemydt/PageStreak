import { Ionicons } from "@expo/vector-icons";
import { Stack, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { COLORS } from "../../themes/colors";
import { FONTS } from "../../themes/typography";

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Tabs
        screenOptions={{
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: COLORS.ink.primary,
          tabBarInactiveTintColor: COLORS.ink.tertiary,
          tabBarLabelStyle: styles.tabBarLabel,
          // The tab bar has a fixed height; scaled labels would be clipped
          tabBarAllowFontScaling: false,
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: COLORS.ink.primary,
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{
            title: t("navigation.home"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={23}
                color={color}
              />
            ),
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="(books)"
          options={{
            title: t("navigation.books"),
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "book" : "book-outline"}
                size={23}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="(progress)"
          options={{
            title: t("navigation.progress"),
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "stats-chart" : "stats-chart-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        {/* Redirect stubs for retired routes (Phase 8.4) */}
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="reading-growth" options={{ href: null }} />
        <Tabs.Screen
          name="settings"
          options={{
            title: t("navigation.settings"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "settings" : "settings-outline"}
                size={23}
                color={color}
              />
            ),
            headerShown: false,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Folio: a paper bar under a hairline (the navigator adds the safe-area inset)
  tabBar: {
    backgroundColor: COLORS.paper.base,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
    elevation: 0,
    shadowOpacity: 0,
    paddingTop: 6,
  },
  tabBarLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  header: {
    backgroundColor: COLORS.paper.base,
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    color: COLORS.ink.primary,
  },
});
