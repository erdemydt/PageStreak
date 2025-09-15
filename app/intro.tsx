import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { execute } from '../db/db';
import NotificationService from '../services/notificationService';

const { width: screenWidth } = Dimensions.get('window');

type Step = 1 | 2 | 3 | 4 | 5;

export default function IntroScreen() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [username, setUsername] = useState('');
  const [yearlyGoal, setYearlyGoal] = useState('');
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [dailyReadingGoal, setDailyReadingGoal] = useState('');
  const [targetDailyGoal, setTargetDailyGoal] = useState('');
  const [goalDate, setGoalDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;

  const genres = [
    t('intro.genres.options.fiction'),
    t('intro.genres.options.nonFiction'),
    t('intro.genres.options.mystery'),
    t('intro.genres.options.romance'),
    t('intro.genres.options.sciFi'),
    t('intro.genres.options.fantasy'),
    t('intro.genres.options.biography'),
    t('intro.genres.options.history'),
    t('intro.genres.options.selfHelp'),
    t('intro.genres.options.business'),
    t('intro.genres.options.poetry'),
    t('intro.genres.options.philosophy'),
    t('intro.genres.options.thriller'),
    t('intro.genres.options.horror'),
    t('intro.genres.options.adventure'),
    t('intro.genres.options.comedy'),
    t('intro.genres.options.drama'),
    t('intro.genres.options.educational')
  ];

  useEffect(() => {
  
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
        setError(t('intro.validation.nameRequired'));
        return;
      }
      if (username.trim().length < 2) {
        setError(t('intro.validation.nameInvalid'));
        return;
      }
      if (username.trim().length > 50) {
        setError(t('intro.validation.nameInvalid'));
        return;
      }
      animateStepTransition(2);
    } else if (currentStep === 2) {
      if (!yearlyGoal.trim()) {
        setError(t('intro.validation.goalRequired'));
        return;
      }
      if (isNaN(Number(yearlyGoal))) {
        setError(t('intro.validation.goalInvalid'));
        return;
      }
      const yearlyGoalNum = Number(yearlyGoal);
      if (yearlyGoalNum <= 0) {
        setError(t('intro.validation.goalInvalid'));
        return;
      }
      if (yearlyGoalNum > 1000) {
        setError(t('intro.validation.goalInvalid'));
        return;
      }
      if (!Number.isInteger(yearlyGoalNum)) {
        setError(t('intro.validation.goalMustBeInteger'));
        return;
      }
      animateStepTransition(3);
    } else if (currentStep === 3) {
      // No validation needed for genres (optional step)
      animateStepTransition(4);
    } else if (currentStep === 4) {
      if (!dailyReadingGoal.trim()) {
        setError(t('intro.validation.dailyGoalRequired'));
        return;
      }
      if (isNaN(Number(dailyReadingGoal))) {
        setError(t('intro.validation.dailyGoalInvalid'));
        return;
      }
      const dailyGoalNum = Number(dailyReadingGoal);
      if (dailyGoalNum <= 0) {
        setError(t('intro.validation.dailyGoalInvalid'));
        return;
      }
      if (dailyGoalNum > 1440) {
        setError(t('intro.validation.dailyGoalTooHigh'));
        return;
      }
      if (dailyGoalNum > 480) {
        setError(t('intro.validation.dailyGoalUnrealistic'));
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
      // Final validation before saving
      if (!targetDailyGoal.trim()) {
        setError('Please enter your target daily reading goal');
        return;
      }
      if (isNaN(Number(targetDailyGoal))) {
        setError('Please enter a valid number of minutes');
        return;
      }
      const targetGoalNum = Number(targetDailyGoal);
      if (targetGoalNum <= 0) {
        setError('Target daily goal must be greater than 0 minutes');
        return;
      }
      if (targetGoalNum > 1440) {
        setError('Target daily goal cannot exceed 24 hours (1440 minutes)');
        return;
      }
      if (targetGoalNum > 480) {
        setError('Target goal seems unrealistic. Please enter a goal less than 8 hours.');
        return;
      }

      const currentGoalNum = Number(dailyReadingGoal);
      if (targetGoalNum < currentGoalNum) {
        setError('Your target goal should be equal to or greater than your current reading time');
        return;
      }

      // Check if the goal date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(goalDate);
      selectedDate.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        setError('Goal date cannot be in the past');
        return;
      }

      // Check if the goal date is too far in the future (more than 5 years)
      const fiveYearsFromNow = new Date();
      fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
      
      if (selectedDate > fiveYearsFromNow) {
        setError('Goal date cannot be more than 5 years in the future');
        return;
      }

      // Use user's input values
      const initialReadingRateMinutesPerDay = currentGoalNum;
      const endReadingRateGoalMinutesPerDay = targetGoalNum;
      const weeklyReadingGoal = initialReadingRateMinutesPerDay * 7;
      const dailyGoal = initialReadingRateMinutesPerDay;

      // Calculate weekly increase needed based on the selected date
      const timeDifferenceMs = goalDate.getTime() - new Date().getTime();
      const weeks = Math.max(1, Math.ceil(timeDifferenceMs / (1000 * 60 * 60 * 24 * 7)));
      
      const totalIncreaseNeeded = endReadingRateGoalMinutesPerDay - initialReadingRateMinutesPerDay;
      const weeklyReadingRateIncreaseMinutes = totalIncreaseNeeded > 0 ? Math.ceil(totalIncreaseNeeded / weeks) : 0;
      const weeklyReadingRateIncreasePercentage = initialReadingRateMinutesPerDay > 0 ?
        (weeklyReadingRateIncreaseMinutes / initialReadingRateMinutesPerDay) * 100 : 0;

      // Use the selected goal date instead of end of year
      const endGoalDate = goalDate.toISOString();

      // Insert or replace the single user preferences record
      await execute(
        `INSERT OR REPLACE INTO user_preferences (
          id, username, yearly_book_goal, preferred_genres, updated_at,
          weekly_reading_goal, 
          initial_reading_rate_minutes_per_day, end_reading_rate_goal_minutes_per_day,
          end_reading_rate_goal_date, current_reading_rate_minutes_per_day,
          current_reading_rate_last_updated, weekly_reading_rate_increase_minutes,
          weekly_reading_rate_increase_minutes_percentage
        ) VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
        [
          username.trim(),
          Number(yearlyGoal),
          preferredGenres.join(','),
          weeklyReadingGoal,
          initialReadingRateMinutesPerDay,
          endReadingRateGoalMinutesPerDay,
          endGoalDate,
          initialReadingRateMinutesPerDay, // current rate starts at initial rate
          weeklyReadingRateIncreaseMinutes,
          weeklyReadingRateIncreasePercentage
        ]
      );

      // Initialize notification preferences for new user
      const notificationPrefs = await NotificationService.getNotificationPreferences();
      if (!notificationPrefs) {
        console.log('🔔 Initializing notification preferences for new user');
      }

      Keyboard.dismiss();

      // Navigate to the main app
      router.replace('/(tabs)/(home)');
    } catch (e) {
      console.error('Error saving preferences:', e);
      if (e instanceof Error) {
        setError(`Failed to save preferences: ${e.message}`);
      } else {
        setError('Failed to save your preferences. Please try again.');
      }
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
        <Text style={styles.stepTitle}>{t('intro.welcome.title')}</Text>
        <Text style={styles.stepSubtitle}>
          {t('intro.welcome.subtitle')}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t('intro.welcome.placeholder')}
          placeholderTextColor="#9CA3AF"
          value={username}
          onChangeText={(text) => {
            // Remove any leading/trailing spaces and limit length
            const cleanText = text.slice(0, 50);
            setUsername(cleanText);
            if (error && text.trim().length >= 2) {
              setError(null);
            }
          }}
          editable={!loading}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={handleNext}
          autoFocus
          maxLength={50}
        />
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>🎯</Text>
        <Text style={styles.stepTitle}>{t('intro.goal.title', { username })}</Text>
        <Text style={styles.stepSubtitle}>
          {t('intro.goal.subtitle')}
        </Text>
      </View>

      <View style={styles.goalContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder={t('intro.goal.placeholder')}
          placeholderTextColor="#9CA3AF"
          value={yearlyGoal}
          onChangeText={(text) => {
            // Only allow numbers
            const numericText = text.replace(/[^0-9]/g, '');
            if (numericText.length <= 4) { // Max 9999 books
              setYearlyGoal(numericText);
              if (error && numericText && Number(numericText) > 0 && Number(numericText) <= 1000) {
                setError(null);
              }
            }
          }}
          editable={!loading}
          keyboardType="numeric"
          returnKeyType="next"
          onSubmitEditing={handleNext}
          autoFocus
          maxLength={4}
        />
        <Text style={styles.goalLabel}>{t('intro.goal.label')}</Text>
      </View>

      <Text style={styles.goalHint}>
        {t('intro.goal.hint')}
      </Text>
    </>
  );

  const renderStep3 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>📚</Text>
        <Text style={styles.stepTitle}>{t('intro.genres.title')}</Text>
        <Text style={styles.stepSubtitle}>
          {t('intro.genres.subtitle')}
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
        <Text style={styles.stepTitle}>{t('intro.currentReading.title')}</Text>
        <Text style={styles.stepSubtitle}>
          {t('intro.currentReading.subtitle')}
        </Text>
      </View>

      <View style={styles.goalContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder={t('intro.currentReading.placeholder')}
          placeholderTextColor="#9CA3AF"
          value={dailyReadingGoal}
          onChangeText={(text) => {
            // Only allow numbers
            const numericText = text.replace(/[^0-9]/g, '');
            if (numericText.length <= 4) { // Max 9999 minutes
              setDailyReadingGoal(numericText);
              if (error && numericText && Number(numericText) > 0 && Number(numericText) <= 480) {
                setError(null);
              }
            }
          }}
          editable={!loading}
          keyboardType="numeric"
          returnKeyType="next"
          onSubmitEditing={handleNext}
          autoFocus
          maxLength={4}
        />
        <Text style={styles.goalLabel}>{t('intro.currentReading.label')}</Text>
      </View>

      <Text style={styles.goalHint}>
        💡 {t('intro.currentReading.hint')}
      </Text>
    </>
  );

  const renderStep5 = () => (
    <View style={{ flex: 1, gap: 0, width: '100%' , justifyContent: 'center', alignItems: 'center' }}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>🚀</Text>
        <Text style={styles.stepTitle}>{t('intro.targetGoal.title')}</Text>
        <Text style={styles.stepSubtitle}>
          {t('intro.targetGoal.subtitle')}
        </Text>
      </View>

      <View style={styles.goalContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder={t('intro.targetGoal.placeholder')}
          placeholderTextColor="#9CA3AF"
          value={targetDailyGoal}
          onChangeText={(text) => {
            // Only allow numbers
            const numericText = text.replace(/[^0-9]/g, '');
            if (numericText.length <= 4) { // Max 9999 minutes
              setTargetDailyGoal(numericText);
              if (error && numericText && Number(numericText) > 0 && Number(numericText) <= 480 && Number(numericText) >= Number(dailyReadingGoal)) {
                setError(null);
              }
            }
          }}
          editable={!loading}
          keyboardType="numeric"
          returnKeyType="done"
          autoFocus
          maxLength={4}
        />
        <Text style={styles.goalLabel}>{t('intro.targetGoal.label')}</Text>
      </View>

      <View style={styles.stepHeader }>
        <Text style={styles.stepEmoji}></Text>
        <Text style={styles.stepTitle}>{t('intro.targetGoal.dateLabel')}</Text>
      </View>


      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker(true)}
          disabled={loading}
        >
          <Text style={styles.datePickerButtonText}>
            📅 {goalDate.toLocaleDateString('en-US', { 
              weekday: 'long',
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
        </TouchableOpacity>
        
        {showDatePicker && (
          <DateTimePicker
            value={goalDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'default' : 'default'}
            minimumDate={new Date()}
            maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() + 5))}
            onChange={(event, date) => {
              // On Android, hide picker regardless of user action
              if (Platform.OS === 'android') {
                setShowDatePicker(false);
              }
              
              // Only update date if user didn't cancel (event.type !== 'dismissed')
              if (date && event.type !== 'dismissed') {
                setGoalDate(date);
                // Clear error if date is valid
                if (error && date >= new Date(new Date().setHours(0, 0, 0, 0))) {
                  setError(null);
                }
              }
              
              // On iOS, hide picker after selection
              if (Platform.OS === 'ios' && event.type === 'set') {
                setShowDatePicker(false);
              }
            }}
          />
        )}
        
        <Text style={{ textAlign: 'center', marginTop: 10, fontSize: 16, color: '#64748B' }}>
          {t('intro.targetGoal.currentWeeklyIncrease', { 
            percentage: calculateNeededWeeklyPercentageIncrease(), 
            classification: classifyPercentageIncrease(Number(calculateNeededWeeklyPercentageIncrease())) 
          })}
        </Text>
      </View>

      <Text style={styles.goalHint}>
        🎯 {t('intro.targetGoal.hint')}
      </Text>
    </View>
  );

  const renderButtons = () => (
    <View style={styles.buttonContainer}>
      {currentStep > 1 && (
        <TouchableOpacity
          style={[styles.backButton]}
          onPress={handleBack}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>{t('intro.buttons.back')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          styles.nextButton,
          (currentStep === 1 && (!username.trim() || username.trim().length < 2 || username.trim().length > 50)) && styles.nextButtonDisabled,
          (currentStep === 2 && (!yearlyGoal.trim() || isNaN(Number(yearlyGoal)) || Number(yearlyGoal) <= 0 || Number(yearlyGoal) > 1000 || !Number.isInteger(Number(yearlyGoal)))) && styles.nextButtonDisabled,
          (currentStep === 4 && (!dailyReadingGoal.trim() || isNaN(Number(dailyReadingGoal)) || Number(dailyReadingGoal) <= 0 || Number(dailyReadingGoal) > 480)) && styles.nextButtonDisabled,
          (currentStep === 5 && (!targetDailyGoal.trim() || isNaN(Number(targetDailyGoal)) || Number(targetDailyGoal) <= 0 || Number(targetDailyGoal) > 480 || Number(targetDailyGoal) < Number(dailyReadingGoal) || new Date(goalDate) < new Date(new Date().setHours(0, 0, 0, 0)))) && styles.nextButtonDisabled,
          loading && styles.nextButtonDisabled
        ]}
        onPress={currentStep === 5 ? handleGetStarted : handleNext}
        disabled={
          loading ||
          (currentStep === 1 && (!username.trim() || username.trim().length < 2 || username.trim().length > 50)) ||
          (currentStep === 2 && (!yearlyGoal.trim() || isNaN(Number(yearlyGoal)) || Number(yearlyGoal) <= 0 || Number(yearlyGoal) > 1000 || !Number.isInteger(Number(yearlyGoal)))) ||
          (currentStep === 4 && (!dailyReadingGoal.trim() || isNaN(Number(dailyReadingGoal)) || Number(dailyReadingGoal) <= 0 || Number(dailyReadingGoal) > 480)) ||
          (currentStep === 5 && (!targetDailyGoal.trim() || isNaN(Number(targetDailyGoal)) || Number(targetDailyGoal) <= 0 || Number(targetDailyGoal) > 480 || Number(targetDailyGoal) < Number(dailyReadingGoal) || new Date(goalDate) < new Date(new Date().setHours(0, 0, 0, 0))))
        }
      >
        <Text style={styles.nextButtonText}>
          {loading ? t('intro.buttons.settingUp') :
            currentStep === 5 ? t('intro.buttons.getStarted') :
              t('intro.buttons.continue')}
        </Text>
      </TouchableOpacity>
    </View>
  );
  const calculateNeededWeeklyPercentageIncrease  = () => {
    const initial = Number(dailyReadingGoal);
    const target = Number(targetDailyGoal);
    if (isNaN(initial) || isNaN(target) || initial <= 0 || target <= 0) return '0.00';

    // If target is same as initial, no increase needed
    if (target === initial) return '0.00';

    // Calculate weeks until goal date
    const timeDifferenceMs = goalDate.getTime() - new Date().getTime();
    const weeks = Math.max(1, Math.ceil(timeDifferenceMs / (1000 * 60 * 60 * 24 * 7)));

    // If target is less than initial, return 0 (no increase needed)
    if (target < initial) return '0.00';

    // percentage^weeks = target/initial
    // weeks * log(percentage) = log(target/initial)
    // log(percentage) = log(target/initial) / weeks
    // percentage = 10^(log(target/initial) / weeks)
    // percentage increase = (percentage - 1) * 100
    const percentage = Math.pow(10, Math.log10(target / initial) / weeks);
    const weeklyIncrease = (percentage - 1) * 100;
    let unformatted = Math.max(0, weeklyIncrease);
    return unformatted.toFixed(2);
  };

  const classifyPercentageIncrease = (percentage: number) => {
    // Classify the percentage increase into categories
    if (percentage <= 5) return t('intro.percentageClassification.minimal');
    if (percentage <= 15) return t('intro.percentageClassification.easy');
    if (percentage <= 40) return t('intro.percentageClassification.moderate');
    if (percentage <= 80) return t('intro.percentageClassification.challenging');
    if (percentage <= 150) return t('intro.percentageClassification.veryDifficult');
    return t('intro.percentageClassification.nearlyImpossible');
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Image 
              source={require('../assets/images/Logo.png')} 
              style={styles.welcomeLogo}
              resizeMode="contain"
            />
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
    </>
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
  welcomeLogo: {
    width: 100,
    height: 100,
    marginBottom: 20,
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
    padding: 15,
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
    marginBottom: 5,
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
    marginBottom: 2,
  },
  goalInput: {
    width: 'auto',
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
    marginTop: 2,
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
    marginTop: 10,
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
  datePickerButton: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
    textAlign: 'center',
  },
});
