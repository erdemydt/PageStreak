import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { checkNotificationDatabaseIntegrity, execute, initializeDatabase, queryFirst, repairNotificationDatabase } from '../db/db';
import NotificationService from '../services/notificationService';

type UserPreferences = {
  id: number;
  username: string;
  yearly_book_goal: number;
  preferred_genres?: string;
  created_at?: string;
  updated_at?: string;
  weekly_reading_goal?: number;
  initial_reading_rate_minutes_per_day?: number;
  end_reading_rate_goal_minutes_per_day?: number;
  end_reading_rate_goal_date?: Date;
  current_reading_rate_minutes_per_day?: number;
  current_reading_rate_last_updated?: Date;
  weekly_reading_rate_increase_minutes?: number;
  weekly_reading_rate_increase_minutes_percentage?: number;
};

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    initializeAppDatabase();
  }, []);

  const initializeAppDatabase = async () => {
    try {
      console.log('🔄 Starting app database initialization...');
      
      // Initialize all database tables first
      await initializeDatabase();
      console.log('✅ Database tables initialized');
      
      // Verify database integrity before proceeding
      const dbIntegrity = await checkNotificationDatabaseIntegrity();
      console.log('📊 Database integrity check:', dbIntegrity);
      
      // If notification tables are missing, repair them
      if (!dbIntegrity.notification_preferences_exists || !dbIntegrity.notification_preferences_has_defaults) {
        console.log('🔧 Repairing notification database...');
        await repairNotificationDatabase();
      }
      
      // Initialize notification service after database is verified
      try {
        await NotificationService.reset();
        
        // Get or create notification preferences (this will handle first-time permission request)
        const notificationPrefs = await NotificationService.getNotificationPreferences();
        console.log('🔔 Notification preferences initialized:', {
          enabled: notificationPrefs?.notifications_enabled,
          reminders: notificationPrefs?.daily_reminder_enabled,
          hours: notificationPrefs?.daily_reminder_hours_after_last_open
        });
        
        // Sync system permissions with database preferences
        await NotificationService.syncPermissionsWithDatabase();
        
        console.log('✅ Notification service initialized and permissions synced');
      } catch (notificationError) {
        console.error('⚠️ Notification service initialization failed, continuing without notifications:', notificationError);
      }
      
      // Then check user setup and handle navigation
      await checkUserSetup();
      
      // Initialize weekly progress logic after database is ready
      await initiateWeeklyProgressLogic();
    } catch (error) {
      console.error('❌ Failed to initialize app database:', error);
      // If database initialization fails, still try to show intro
      setHasUser(false);
      router.replace('/intro');
      setIsLoading(false);
    }
  };

  const initiateWeeklyProgressLogic = async () => {
    try {
      const info = await getUserGoalInformation();
      if (!info) return;
      
      const dateToCheck = info?.current_reading_rate_last_updated ? new Date(info.current_reading_rate_last_updated) : new Date();
      const weeksPassed = getWeeksPassed(dateToCheck);
      
      if (weeksPassed > 0 && info.end_reading_rate_goal_date && new Date(info.end_reading_rate_goal_date) > new Date()) {
        const lastProgress = await getLastWeeklyProgress();
        
        if (lastProgress) {
          // Update reading rate using percentage increase
          let newReadingRate = info.current_reading_rate_minutes_per_day * (1 + (info.weekly_reading_rate_increase_minutes_percentage / 100));
          newReadingRate = Math.min(newReadingRate, info.end_reading_rate_goal_minutes_per_day);
          newReadingRate = Math.max(newReadingRate, info.current_reading_rate_minutes_per_day + 1); // Ensure it doesn't drop below initial + 1
          const newReadingRateInteger = Math.round(newReadingRate);
          
          await execute('UPDATE user_preferences SET current_reading_rate_minutes_per_day = ?, current_reading_rate_last_updated = ? WHERE id = 1', [newReadingRateInteger, new Date().toISOString()]);
          console.log('✅ Updated reading rate based on percentage increase');
          
          // Update weekly progress with new achieved reading minutes
          const newAchivedMinutes = newReadingRate;
          await execute('UPDATE weekly_progress SET weeks_passed = ?, achived_reading_minutes = ? WHERE id = ?', [weeksPassed, newAchivedMinutes, lastProgress.id]);
          console.log('✅ Weekly progress updated');
        } else {
          // No previous record, insert a full new one using info
          const initialReadingRate = info.initial_reading_rate_minutes_per_day;
          const achivedReadingMinutes = initialReadingRate;
          
          await execute(`
            INSERT INTO weekly_progress (weeks_passed, target_reading_minutes, achived_reading_minutes)
            VALUES (?, ?, ?)
          `, [0, info.end_reading_rate_goal_minutes_per_day, Math.round(achivedReadingMinutes)]);
          console.log('✅ Weekly progress initialized');
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize weekly progress logic:', error);
    }
  };

  const checkUserSetup = async () => {
    try {
      const user = await queryFirst<UserPreferences>('SELECT * FROM user_preferences WHERE id = 1');
      setHasUser(!!user);

      // Automatically navigate based on user status
      if (user) {
        router.replace('/(tabs)/(home)');
      } else {
        router.replace('/intro');
      }
    } catch (error) {
      console.error('❌ Error checking user setup:', error);
      // If table doesn't exist or error, show intro
      setHasUser(false);
      router.replace('/intro');
    } finally {
      setIsLoading(false);
    }
  };

  const getWeeksPassed = (startDate: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - startDate.getTime();
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7));
  };

  const getLastWeeklyProgress = async () => {
    try {
      const progress = await queryFirst('SELECT * FROM weekly_progress ORDER BY weeks_passed DESC LIMIT 1');
      return progress || null;
    } catch (error) {
      console.error('❌ Error fetching last weekly progress:', error);
      return null;
    }
  };

  const getUserGoalInformation = async () => {
    try {
      const user = await queryFirst<UserPreferences>('SELECT * FROM user_preferences WHERE id = 1');
      if (!user) return null;
      
      return {
        weekly_reading_goal: user.weekly_reading_goal || 210,
        initial_reading_rate_minutes_per_day: user.initial_reading_rate_minutes_per_day || 30,
        end_reading_rate_goal_minutes_per_day: user.end_reading_rate_goal_minutes_per_day || 60,
        end_reading_rate_goal_date: user.end_reading_rate_goal_date || null,
        current_reading_rate_minutes_per_day: user.current_reading_rate_minutes_per_day || 30,
        current_reading_rate_last_updated: user.current_reading_rate_last_updated || null,
        weekly_reading_rate_increase_minutes: user.weekly_reading_rate_increase_minutes || 1,
        weekly_reading_rate_increase_minutes_percentage: user.weekly_reading_rate_increase_minutes_percentage || 3.33
      };
    } catch (error) {
      console.error('❌ Error fetching user goal information:', error);
      return null;
    }
  };
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Image 
          source={require('../assets/images/Logo.png')} 
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <Text style={styles.loadingText}>PageStreak</Text>
      </View>
    );
  }

  // This component will only briefly show while navigation is happening
  return (
    <View style={styles.loadingContainer}>
      <Image 
        source={require('../assets/images/Logo.png')} 
        style={styles.loadingLogo}
        resizeMode="contain"
      />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingLogo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
});
