import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f4511e',
          },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="details" />
      <Stack.Screen name="[id]" getId={({ params }) => params?.id || 0} />
    </Stack>
    </>
  );
}
