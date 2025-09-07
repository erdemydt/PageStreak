import { Stack } from 'expo-router';

export default function BooksLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#6C63FF',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Books',
        }}
      />
      <Stack.Screen
        name="search"
        options={{
          title: 'Search Books',
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
