import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { queryFirst } from '../db/db';

type UserPreferences = {
  id: number;
  username: string;
  yearly_book_goal: number;
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
    } catch (error) {
      // If table doesn't exist or error, show intro
      setHasUser(false);
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

  if (!hasUser) {
    return <Redirect href="/intro" />;
  }

  return <Redirect href="/(tabs)/(home)" />;
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
