import { Stack } from "expo-router";
import { COLORS } from "../../../themes/colors";

export default function BooksLayout() {
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
          title: "Books",
        }}
      />
      <Stack.Screen
        name="search"
        options={{
          title: "Search Books",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="my-books"
        options={{
          title: "My Books",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Book Details",
          presentation: "card",
        }}
      />
    </Stack>
  );
}
