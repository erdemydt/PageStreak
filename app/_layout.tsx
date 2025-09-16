import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { LanguageProvider } from '../contexts/LanguageContext';
import '../i18n';
import NotificationService from '../services/notificationService';

export default function RootLayout() {
  useEffect(() => {
    // Initialize notification service and track app opened
    const initializeNotifications = async () => {
      try {
        await NotificationService.onAppStateChange('active');
        
        // Don't request permissions here - let the first-time setup handle it
        // This prevents duplicate permission requests
        console.log('🔔 Notification service app state tracking initialized');
      } catch (error) {
        console.error('❌ Error initializing notifications:', error);
      }
    };
    
    initializeNotifications();

    // Set up app state change listener
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      NotificationService.onAppStateChange(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen 
          name="intro" 
          options={{ 
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom'
          }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
      </Stack>
    </LanguageProvider>
  );
}
