import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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
import { execute, queryAll } from '../db/db';

const { width: screenWidth } = Dimensions.get('window');

type Step = 1 | 2 | 3 | 4 | 5;

export default function IntroScreen() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [username, setUsername] = useState('');
  const [yearlyGoal, setYearlyGoal] = useState('');
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [dailyReadingGoal, setDailyReadingGoal] = useState('');
  const [targetDailyGoal, setTargetDailyGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;

  const genres = [
    'Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Sci-Fi', 'Fantasy',
    'Biography', 'History', 'Self-Help', 'Business', 'Poetry', 'Philosophy',
    'Thriller', 'Horror', 'Adventure', 'Comedy', 'Drama', 'Educational'
  ];

  useEffect(() => {
    // Create the user_preferences table, if it doesn't exist, but add new columns as needed
    (async () => {
      try {
        // First, create the table with basic structure if it doesn't exist
        await execute(`
          CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            username TEXT NOT NULL,
            yearly_book_goal INTEGER NOT NULL,
            preferred_genres TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Define all the columns we need with their types and constraints
        const requiredColumns = [
          { name: 'weekly_reading_goal', type: 'INTEGER NOT NULL', defaultValue: '210' },
          { name: 'daily_reading_goal', type: 'INTEGER NOT NULL', defaultValue: '30' },
          { name: 'initial_reading_rate_minutes_per_day', type: 'INTEGER NOT NULL', defaultValue: '30' },
          { name: 'end_reading_rate_goal_minutes_per_day', type: 'INTEGER NOT NULL', defaultValue: '60' },
          { name: 'end_reading_rate_goal_date', type: 'DATETIME', defaultValue: null },
          { name: 'current_reading_rate_minutes_per_day', type: 'INTEGER NOT NULL', defaultValue: '30' },
          { name: 'current_reading_rate_last_updated', type: 'DATETIME', defaultValue: null },
          { name: 'weekly_reading_rate_increase_minutes', type: 'INTEGER NOT NULL', defaultValue: '1' },
          { name: 'weekly_reading_rate_increase_minutes_percentage', type: 'FLOAT NOT NULL', defaultValue: '3.33' }
        ];

        // Get current table structure
        const tableInfo = await queryAll('PRAGMA table_info(user_preferences)');
        const existingColumns = tableInfo.map((row: any) => row.name);

        // Add missing columns
        for (const column of requiredColumns) {
          if (!existingColumns.includes(column.name)) {
            let alterQuery = `ALTER TABLE user_preferences ADD COLUMN ${column.name} ${column.type}`;
            if (column.defaultValue) {
              alterQuery += ` DEFAULT ${column.defaultValue}`;
            }
            await execute(alterQuery);
          }
        }

      } catch (error) {
        console.error('Error setting up user_preferences table:', error);
      }
    })();
  }, []);

  const animateStepTransition = (nextStep: Step) => {
    // First, fade out the current step
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: -50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Change the step after fade out is complete
      setCurrentStep(nextStep);
      
      // Reset position for slide in
      slideAnimation.setValue(50);
      
      // Use requestAnimationFrame to ensure the state change has been applied
      requestAnimationFrame(() => {
        // Animate in the new step
        Animated.parallel([
          Animated.timing(fadeAnimation, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnimation, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
  };

  const toggleGenre = (genre: string) => {
    setPreferredGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleNext = () => {
    setError(null);
    
    if (currentStep === 1) {
      if (!username.trim()) {
        setError('Please enter your name');
        return;
      }
      animateStepTransition(2);
    } else if (currentStep === 2) {
      if (!yearlyGoal.trim() || isNaN(Number(yearlyGoal)) || Number(yearlyGoal) <= 0) {
        setError('Please enter a valid yearly book goal');
        return;
      }
      animateStepTransition(3);
    } else if (currentStep === 3) {
      animateStepTransition(4);
    } else if (currentStep === 4) {
      if (!dailyReadingGoal.trim() || isNaN(Number(dailyReadingGoal)) || Number(dailyReadingGoal) <= 0) {
        setError('Please enter your current daily reading time');
        return;
      }
      animateStepTransition(5);
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep === 2) {
      animateStepTransition(1);
    } else if (currentStep === 3) {
      animateStepTransition(2);
    } else if (currentStep === 4) {
      animateStepTransition(3);
    } else if (currentStep === 5) {
      animateStepTransition(4);
    }
  };

  const handleGetStarted = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use user's input values
      const initialReadingRateMinutesPerDay = Number(dailyReadingGoal);
      const endReadingRateGoalMinutesPerDay = Number(targetDailyGoal);
      const weeklyReadingGoal = initialReadingRateMinutesPerDay * 7;
      const dailyGoal = initialReadingRateMinutesPerDay;
      
      // Calculate weekly increase needed to reach the goal over 52 weeks
      const totalIncreaseNeeded = endReadingRateGoalMinutesPerDay - initialReadingRateMinutesPerDay;
      const weeklyReadingRateIncreaseMinutes = totalIncreaseNeeded > 0 ? Math.ceil(totalIncreaseNeeded / 52) : 0;
      const weeklyReadingRateIncreasePercentage = initialReadingRateMinutesPerDay > 0 ? 
        (weeklyReadingRateIncreaseMinutes / initialReadingRateMinutesPerDay) * 100 : 0;
      
      // Set end goal date to end of current year
      const currentYear = new Date().getFullYear();
      const endGoalDate = new Date(currentYear, 11, 31).toISOString(); // December 31st
      
      // Insert or replace the single user preferences record
      await execute(
        `INSERT OR REPLACE INTO user_preferences (
          id, username, yearly_book_goal, preferred_genres, updated_at,
          weekly_reading_goal, daily_reading_goal, 
          initial_reading_rate_minutes_per_day, end_reading_rate_goal_minutes_per_day,
          end_reading_rate_goal_date, current_reading_rate_minutes_per_day,
          current_reading_rate_last_updated, weekly_reading_rate_increase_minutes,
          weekly_reading_rate_increase_minutes_percentage
        ) VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
        [
          username.trim(), 
          Number(yearlyGoal), 
          preferredGenres.join(','),
          weeklyReadingGoal,
          dailyGoal,
          initialReadingRateMinutesPerDay,
          endReadingRateGoalMinutesPerDay,
          endGoalDate,
          initialReadingRateMinutesPerDay, // current rate starts at initial rate
          weeklyReadingRateIncreaseMinutes,
          weeklyReadingRateIncreasePercentage
        ]
      );

      Keyboard.dismiss();
      
      // Navigate to the main app
      router.replace('/(tabs)/(home)');
    } catch (e) {
      setError('Failed to save your preferences. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4, 5].map((step) => (
        <View key={step} style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressDot,
              currentStep >= step && styles.progressDotActive,
              currentStep === step && styles.progressDotCurrent
            ]} 
          />
          {step < 5 && (
            <View style={[
              styles.progressLine,
              currentStep > step && styles.progressLineActive
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>👋</Text>
        <Text style={styles.stepTitle}>Nice to meet you!</Text>
        <Text style={styles.stepSubtitle}>
          What should we call you on your reading journey?
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          placeholderTextColor="#9CA3AF"
          value={username}
          onChangeText={setUsername}
          editable={!loading}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={handleNext}
          autoFocus
        />
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>🎯</Text>
        <Text style={styles.stepTitle}>Set your goal, {username}!</Text>
        <Text style={styles.stepSubtitle}>
          How many books would you like to read this year?
        </Text>
      </View>

      <View style={styles.goalContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder="12"
          placeholderTextColor="#9CA3AF"
          value={yearlyGoal}
          onChangeText={setYearlyGoal}
          editable={!loading}
          keyboardType="numeric"
          returnKeyType="next"
          onSubmitEditing={handleNext}
          autoFocus
        />
        <Text style={styles.goalLabel}>books</Text>
      </View>
      
      <Text style={styles.goalHint}>
        💡 Start with a realistic goal - you can always adjust it later!
      </Text>
    </>
  );

  const renderStep3 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>📚</Text>
        <Text style={styles.stepTitle}>What do you love to read?</Text>
        <Text style={styles.stepSubtitle}>
          Select your favorite genres (optional)
        </Text>
      </View>

      <ScrollView style={styles.genresContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.genresGrid}>
          {genres.map((genre) => (
            <TouchableOpacity
              key={genre}
              style={[
                styles.genreChip,
                preferredGenres.includes(genre) && styles.genreChipSelected
              ]}
              onPress={() => toggleGenre(genre)}
              disabled={loading}
            >
              <Text style={[
                styles.genreChipText,
                preferredGenres.includes(genre) && styles.genreChipTextSelected
              ]}>
                {genre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </>
  );

  const renderStep4 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>⏰</Text>
        <Text style={styles.stepTitle}>How much do you read daily?</Text>
        <Text style={styles.stepSubtitle}>
          How many minutes do you currently spend reading per day?
        </Text>
      </View>

      <View style={styles.goalContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder="30"
          placeholderTextColor="#9CA3AF"
          value={dailyReadingGoal}
          onChangeText={setDailyReadingGoal}
          editable={!loading}
          keyboardType="numeric"
          returnKeyType="next"
          onSubmitEditing={handleNext}
          autoFocus
        />
        <Text style={styles.goalLabel}>minutes</Text>
      </View>
      
      <Text style={styles.goalHint}>
        💡 Be honest about your current habits - this helps us track your progress!
      </Text>
    </>
  );

  const renderStep5 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>🚀</Text>
        <Text style={styles.stepTitle}>What's your reading goal?</Text>
        <Text style={styles.stepSubtitle}>
          How many minutes would you like to read daily by the end of the year?
        </Text>
      </View>

      <View style={styles.goalContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder="60"
          placeholderTextColor="#9CA3AF"
          value={targetDailyGoal}
          onChangeText={setTargetDailyGoal}
          editable={!loading}
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={handleGetStarted}
          autoFocus
        />
        <Text style={styles.goalLabel}>minutes</Text>
      </View>
      
      <Text style={styles.goalHint}>
        🎯 We'll help you gradually increase your reading time to reach this goal!
      </Text>
    </>
  );

  const renderButtons = () => (
    <View style={styles.buttonContainer}>
      {currentStep > 1 && (
        <TouchableOpacity
          style={[styles.backButton]}
          onPress={handleBack}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}
      
      <TouchableOpacity
        style={[
          styles.nextButton,
          currentStep === 1 && !username.trim() && styles.nextButtonDisabled,
          currentStep === 2 && (!yearlyGoal.trim() || isNaN(Number(yearlyGoal)) || Number(yearlyGoal) <= 0) && styles.nextButtonDisabled,
          currentStep === 4 && (!dailyReadingGoal.trim() || isNaN(Number(dailyReadingGoal)) || Number(dailyReadingGoal) <= 0) && styles.nextButtonDisabled,
          currentStep === 5 && (!targetDailyGoal.trim() || isNaN(Number(targetDailyGoal)) || Number(targetDailyGoal) <= 0) && styles.nextButtonDisabled,
          loading && styles.nextButtonDisabled
        ]}
        onPress={currentStep === 5 ? handleGetStarted : handleNext}
        disabled={
          loading ||
          (currentStep === 1 && !username.trim()) ||
          (currentStep === 2 && (!yearlyGoal.trim() || isNaN(Number(yearlyGoal)) || Number(yearlyGoal) <= 0)) ||
          (currentStep === 4 && (!dailyReadingGoal.trim() || isNaN(Number(dailyReadingGoal)) || Number(dailyReadingGoal) <= 0)) ||
          (currentStep === 5 && (!targetDailyGoal.trim() || isNaN(Number(targetDailyGoal)) || Number(targetDailyGoal) <= 0))
        }
      >
        <Text style={styles.nextButtonText}>
          {loading ? 'Setting up...' : 
           currentStep === 5 ? 'Get Started! 🚀' : 
           'Continue →'}
        </Text>
      </TouchableOpacity>
    </View>
  );

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
  
            <Text style={styles.welcomeTitle}>Welcome to PageStreak!</Text>
            <Text style={styles.welcomeSubtitle}>
              Let's set up your reading journey in just a few steps
            </Text>
          </View>

          {renderProgressBar()}

          <View style={styles.card}>
            <Animated.View 
              style={[
                styles.stepContainer,
                {
                  opacity: fadeAnimation,
                  transform: [{ translateY: slideAnimation }]
                }
              ]}
            >
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
              {currentStep === 5 && renderStep5()}
            </Animated.View>

            {error && <Text style={styles.error}>{error}</Text>}

            {renderButtons()}
          </View>

          {currentStep === 5 && (
            <View style={styles.featuresContainer}>
              <Text style={styles.featuresTitle}>You're all set to:</Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureEmoji}>📖</Text>
                  <Text style={styles.featureText}>Track your reading progress</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureEmoji}>🎯</Text>
                  <Text style={styles.featureText}>Achieve your yearly goal</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureEmoji}>📊</Text>
                  <Text style={styles.featureText}>View detailed statistics</Text>
                </View>
              </View>
            </View>
          )}
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
    marginBottom: 32,
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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  progressDotActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  progressDotCurrent: {
    backgroundColor: '#FFFFFF',
    borderColor: '#6C63FF',
    transform: [{ scale: 1.2 }],
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#6C63FF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 24,
    minHeight: 300,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  inputContainer: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    height: 56,
    borderColor: '#E2E8F0',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    fontSize: 18,
    color: '#1E293B',
    textAlign: 'center',
    fontWeight: '500',
  },
  goalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  goalInput: {
    width: 80,
    height: 56,
    borderColor: '#E2E8F0',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    fontSize: 24,
    color: '#1E293B',
    textAlign: 'center',
    fontWeight: 'bold',
    marginRight: 16,
  },
  goalLabel: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '500',
  },
  goalHint: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 16,
  },
  genresContainer: {
    maxHeight: 200,
    width: '100%',
  },
  genresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  genreChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    margin: 4,
  },
  genreChipSelected: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  genreChipText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  genreChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  error: {
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 32,
    gap: 16,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flex: 1,
  },
  backButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  nextButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    flex: 2,
  },
  nextButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
