import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { execute } from '../db/db';

export default function IntroScreen() {
  const [username, setUsername] = useState('');
  const [yearlyGoal, setYearlyGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create the user_preferences table
    (async () => {
      await execute(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          username TEXT NOT NULL,
          yearly_book_goal INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    })();
  }, []);

  const handleGetStarted = async () => {
    if (!username.trim() || !yearlyGoal.trim() || isNaN(Number(yearlyGoal)) || Number(yearlyGoal) <= 0) {
      setError('Please enter a valid username and yearly book goal');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Insert or replace the single user preferences record
      await execute(
        'INSERT OR REPLACE INTO user_preferences (id, username, yearly_book_goal) VALUES (1, ?, ?)',
        [username.trim(), Number(yearlyGoal)]
      );

      Keyboard.dismiss();
      
      // Navigate to the main app
      router.replace('/(tabs)/(home)');
    } catch (e) {
      setError('Failed to save your preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.welcomeEmoji}>📚</Text>
          <Text style={styles.welcomeTitle}>Welcome to PageStreak!</Text>
          <Text style={styles.welcomeSubtitle}>
            Let's set up your reading journey and track your progress throughout the year
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tell us about yourself</Text>
          
          <View style={styles.inputContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>What should we call you?</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={setUsername}
                editable={!loading}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>How many books do you want to read this year?</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 12"
                placeholderTextColor="#9CA3AF"
                value={yearlyGoal}
                onChangeText={setYearlyGoal}
                editable={!loading}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={handleGetStarted}
              />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading && (
            <TouchableOpacity
              style={[styles.getStartedBtn, (!username.trim() || !yearlyGoal.trim() || loading) && styles.getStartedBtnDisabled]}
              onPress={handleGetStarted}
              disabled={loading || !username.trim() || !yearlyGoal.trim()}
            >
              <Text style={styles.getStartedBtnText}>
                {loading ? 'Setting up...' : 'Get Started! 🚀'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What you can do:</Text>
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureEmoji}>📖</Text>
              <Text style={styles.featureText}>Track books you're reading</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureEmoji}>🎯</Text>
              <Text style={styles.featureText}>Monitor your yearly reading goal</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureEmoji}>📊</Text>
              <Text style={styles.featureText}>See your reading progress</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    height: 52,
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#1E293B',
  },
  error: {
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  getStartedBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  getStartedBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  getStartedBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  featuresContainer: {
    alignItems: 'center',
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
});
