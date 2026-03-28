import { Stack } from "expo-router";
import { COLORS } from "../../../themes/colors";

export default function BooksLayout() {
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
    </Stack>
  );
}
