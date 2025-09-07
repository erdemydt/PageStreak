import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { queryFirst } from '../db/db';

type UserPreferences = {
  id: number;
  username: string;
  yearly_book_goal: number;
  preferred_genres?: string;
  created_at?: string;
  updated_at?: string;
};

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    checkUserSetup();
  }, []);

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
      // If table doesn't exist or error, show intro
      setHasUser(false);
      router.replace('/intro');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingEmoji}>📚</Text>
        <Text style={styles.loadingText}>PageStreak</Text>
      </View>
    );
  }

  // This component will only briefly show while navigation is happening
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingEmoji}>📚</Text>
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
  loadingEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
});
