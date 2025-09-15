import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function HomeLayout() {
  const { t } = useTranslation();
  
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
          title: t('navigation.home'),
        }}
      />
  
    <Stack.Screen
      name="readinglogs"
      options={{
        title: t('components.readingLogs.title'),
      }}
    />
    </Stack>
  );
}
