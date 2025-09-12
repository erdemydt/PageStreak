import { Ionicons } from '@expo/vector-icons';
import { Stack, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <View style={{flex: 1}}>
      <Stack.Screen options={{ headerShown: false }} />
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 0,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            height: Platform.OS === 'ios' ? 88 : 70,
            paddingBottom: Platform.OS === 'ios' ? 20 : 10,
            paddingTop: 10,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          },
          tabBarActiveTintColor: '#6C63FF',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: 4,
          },
          headerStyle: {
            backgroundColor: '#6C63FF',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTitleStyle: {
            color: '#ffffff',
            fontSize: 20,
            fontWeight: 'bold',
          },
          headerTintColor: '#ffffff',
        }}
      >
        <Tabs.Screen 
          name="(home)" 
          options={{ 
            title: t('navigation.home'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
            headerShown: false,
          }} 
        />
        <Tabs.Screen 
          name="(books)" 
          options={{ 
            title: t('navigation.books'),
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book" size={size} color={color} />
            ),
          }} 
        />
        <Tabs.Screen 
          name="profile" 
          options={{ 
            title: t('navigation.profile'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
            headerShown: false,
          }} 
        />
        <Tabs.Screen 
          name="settings" 
          options={{ 
            title: t('navigation.settings'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
            headerShown: false,
          }} 
        />
      </Tabs>
    </View>
  );
}
