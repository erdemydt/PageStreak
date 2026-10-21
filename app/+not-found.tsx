import { Link, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t("navigation.notFoundTitle") }} />
      <View style={styles.container}>
        <Link href="/">{t("navigation.goHome")}</Link>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
