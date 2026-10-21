import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DataImportModal from "../components/DataImportModal";
import { introStyles } from "../components/intro/introStyles";
import TargetGoalStep from "../components/intro/TargetGoalStep";
import {
  getUserPreferences,
  saveOnboardingPreferences,
} from "../db/repos/preferences";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import { GENRE_KEYS, genreLabel } from "../utils/genres";
import {
  applyWeeklyGoalGrowth,
  computeGrowthGoalFields,
} from "../utils/goalSettings";

type Step = 1 | 2 | 3 | 4 | 5;

export default function IntroScreen() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [username, setUsername] = useState("");
  const [yearlyGoal, setYearlyGoal] = useState("");
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [dailyReadingGoal, setDailyReadingGoal] = useState("");
  const [targetDailyGoal, setTargetDailyGoal] = useState("");
  // Default the target ~3 months out; "today" made the whole increase land in one week
  const [goalDate, setGoalDate] = useState<Date>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [wantsReminders, setWantsReminders] = useState(true);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;

  const genres = GENRE_KEYS;

  useEffect(() => {}, []);

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
    setPreferredGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  };

  const handleNext = () => {
    setError(null);

    if (currentStep === 1) {
      if (!username.trim()) {
        setError(t("intro.validation.nameRequired"));
        return;
      }
      if (username.trim().length < 2) {
        setError(t("intro.validation.nameInvalid"));
        return;
      }
      if (username.trim().length > 50) {
        setError(t("intro.validation.nameInvalid"));
        return;
      }
      animateStepTransition(2);
    } else if (currentStep === 2) {
      if (!yearlyGoal.trim()) {
        setError(t("intro.validation.goalRequired"));
        return;
      }
      if (isNaN(Number(yearlyGoal))) {
        setError(t("intro.validation.goalInvalid"));
        return;
      }
      const yearlyGoalNum = Number(yearlyGoal);
      if (yearlyGoalNum <= 0) {
        setError(t("intro.validation.goalInvalid"));
        return;
      }
      if (yearlyGoalNum > 1000) {
        setError(t("intro.validation.goalInvalid"));
        return;
      }
      if (!Number.isInteger(yearlyGoalNum)) {
        setError(t("intro.validation.goalMustBeInteger"));
        return;
      }
      animateStepTransition(3);
    } else if (currentStep === 3) {
      // No validation needed for genres (optional step)
      animateStepTransition(4);
    } else if (currentStep === 4) {
      if (!dailyReadingGoal.trim()) {
        setError(t("intro.validation.dailyGoalRequired"));
        return;
      }
      if (isNaN(Number(dailyReadingGoal))) {
        setError(t("intro.validation.dailyGoalInvalid"));
        return;
      }
      const dailyGoalNum = Number(dailyReadingGoal);
      if (dailyGoalNum <= 0) {
        setError(t("intro.validation.dailyGoalInvalid"));
        return;
      }
      if (dailyGoalNum > 1440) {
        setError(t("intro.validation.dailyGoalTooHigh"));
        return;
      }
      if (dailyGoalNum > 480) {
        setError(t("intro.validation.dailyGoalUnrealistic"));
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
        setError(t("intro.validation.targetGoalRequired"));
        return;
      }
      if (isNaN(Number(targetDailyGoal))) {
        setError(t("intro.validation.targetGoalInvalid"));
        return;
      }
      const targetGoalNum = Number(targetDailyGoal);
      if (targetGoalNum <= 0) {
        setError(t("intro.validation.targetGoalInvalid"));
        return;
      }
      if (targetGoalNum > 1440) {
        setError(t("intro.validation.targetGoalTooHigh"));
        return;
      }
      if (targetGoalNum > 480) {
        setError(t("intro.validation.targetGoalUnrealistic"));
        return;
      }

      const currentGoalNum = Number(dailyReadingGoal);
      if (targetGoalNum < currentGoalNum) {
        setError(t("intro.validation.targetGoalTooLow"));
        return;
      }

      // Check if the goal date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(goalDate);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        setError(t("intro.validation.dateInPast"));
        return;
      }

      // Check if the goal date is too far in the future (more than 5 years)
      const fiveYearsFromNow = new Date();
      fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);

      if (selectedDate > fiveYearsFromNow) {
        setError(t("intro.validation.dateTooFar"));
        return;
      }

      // Same plan model as the preview, Profile and Growth Journey
      const plan = computeGrowthGoalFields({
        currentDailyGoal: currentGoalNum,
        targetDailyGoal: targetGoalNum,
        targetDate: goalDate.toISOString(),
      });

      await saveOnboardingPreferences({
        username: username.trim(),
        yearlyBookGoal: Number(yearlyGoal),
        preferredGenres,
        initialRate: plan.initialReadingRate,
        targetRate: plan.targetReadingRate,
        targetDate: plan.endGoalDate,
        weeklyIncreaseMinutes: plan.weeklyIncreaseMinutes,
        weeklyIncreasePercentage: plan.weeklyIncreasePercentage,
      });

      // Reminders: ask for permission now, with context, and only if the
      // user wants them (never at first launch). Failures here must not block
      // finishing onboarding.
      try {
        await NotificationService.getNotificationPreferences(); // ensure the row exists
        // Record the choice first, so an interruption during the system prompt
        // can't leave reminders off when the user wanted them (boot sync turns
        // them off again if permission ends up missing)
        await NotificationService.updateNotificationPreferences({
          notifications_enabled: wantsReminders,
          daily_reminder_enabled: wantsReminders,
        });
        const granted = wantsReminders
          ? await NotificationService.requestPermissions()
          : false;
        await NotificationService.updateNotificationPreferences({
          notifications_enabled: granted,
          daily_reminder_enabled: granted,
        });
      } catch (notificationError) {
        console.error("Error setting up reminders:", notificationError);
      }

      Keyboard.dismiss();

      // Navigate to the main app
      router.replace("/(tabs)/(home)");
    } catch (e) {
      console.error("Error saving preferences:", e);
      setError(t("intro.validation.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4, 5].map((step) => (
        <View key={step} style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressDot,
              currentStep >= step && styles.progressDotActive,
              currentStep === step && styles.progressDotCurrent,
            ]}
          />
          {step < 5 && (
            <View
              style={[
                styles.progressLine,
                currentStep > step && styles.progressLineActive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>👋</Text>
        <Text style={styles.stepTitle}>{t("intro.welcome.title")}</Text>
        <Text style={styles.stepSubtitle}>{t("intro.welcome.subtitle")}</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t("intro.welcome.placeholder")}
          placeholderTextColor={COLORS.neutral[400]}
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

      <TouchableOpacity
        style={styles.restoreLink}
        onPress={() => setShowImportModal(true)}
        disabled={loading}
      >
        <Text style={styles.restoreLinkText}>
          {t("intro.welcome.restoreBackup")}
        </Text>
      </TouchableOpacity>
    </>
  );

  const handleRestoreSuccess = async () => {
    setShowImportModal(false);
    try {
      // The restored plan may be weeks old: catch up its goal before Home loads
      await applyWeeklyGoalGrowth();
      // The restored settings may have reminders on, but this install never
      // asked for permission (the reminder step is skipped): ask now
      const notificationPrefs =
        await NotificationService.getNotificationPreferences();
      if (
        notificationPrefs?.notifications_enabled &&
        notificationPrefs?.daily_reminder_enabled
      ) {
        const granted = await NotificationService.requestPermissions();
        if (!granted) {
          await NotificationService.updateNotificationPreferences({
            notifications_enabled: false,
            daily_reminder_enabled: false,
          });
        }
      }
      // A backup with a profile makes onboarding unnecessary
      if (await getUserPreferences()) {
        // Let the import sheet finish dismissing before replacing this screen
        setTimeout(() => router.replace("/(tabs)/(home)"), 400);
      } else {
        setError(t("intro.welcome.restoreNoProfile"));
      }
    } catch (e) {
      console.error("Error after restoring backup:", e);
      setError(t("intro.validation.saveFailed"));
    }
  };

  const renderStep2 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>🎯</Text>
        <Text style={styles.stepTitle}>
          {t("intro.goal.title", { username })}
        </Text>
        <Text style={styles.stepSubtitle}>{t("intro.goal.subtitle")}</Text>
      </View>

      <View style={styles.goalContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder={t("intro.goal.placeholder")}
          placeholderTextColor={COLORS.neutral[400]}
          value={yearlyGoal}
          onChangeText={(text) => {
            // Only allow numbers
            const numericText = text.replace(/[^0-9]/g, "");
            if (numericText.length <= 4) {
              // Max 9999 books
              setYearlyGoal(numericText);
              if (
                error &&
                numericText &&
                Number(numericText) > 0 &&
                Number(numericText) <= 1000
              ) {
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
        <Text style={styles.goalLabel}>{t("intro.goal.label")}</Text>
      </View>

      <Text style={styles.goalHint}>{t("intro.goal.hint")}</Text>
    </>
  );

  const renderStep3 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepEmoji}>📚</Text>
        <Text style={styles.stepTitle}>{t("intro.genres.title")}</Text>
        <Text style={styles.stepSubtitle}>{t("intro.genres.subtitle")}</Text>
      </View>

      <ScrollView
        style={styles.genresContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.genresGrid}>
          {genres.map((genre) => (
            <TouchableOpacity
              key={genre}
              style={[
                styles.genreChip,
                preferredGenres.includes(genre) && styles.genreChipSelected,
              ]}
              onPress={() => toggleGenre(genre)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.genreChipText,
                  preferredGenres.includes(genre) &&
                    styles.genreChipTextSelected,
                ]}
              >
                {genreLabel(genre)}
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
        <Text style={styles.stepTitle}>{t("intro.currentReading.title")}</Text>
        <Text style={styles.stepSubtitle}>
          {t("intro.currentReading.subtitle")}
        </Text>
      </View>

      <View style={styles.goalContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder={t("intro.currentReading.placeholder")}
          placeholderTextColor={COLORS.neutral[400]}
          value={dailyReadingGoal}
          onChangeText={(text) => {
            // Only allow numbers
            const numericText = text.replace(/[^0-9]/g, "");
            if (numericText.length <= 4) {
              // Max 9999 minutes
              setDailyReadingGoal(numericText);
              if (
                error &&
                numericText &&
                Number(numericText) > 0 &&
                Number(numericText) <= 480
              ) {
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
        <Text style={styles.goalLabel}>{t("intro.currentReading.label")}</Text>
      </View>

      <Text style={styles.goalHint}>💡 {t("intro.currentReading.hint")}</Text>
    </>
  );

  const renderStep5 = () => (
    <TargetGoalStep
      dailyReadingGoal={dailyReadingGoal}
      targetDailyGoal={targetDailyGoal}
      onChangeTargetDailyGoal={setTargetDailyGoal}
      goalDate={goalDate}
      onChangeGoalDate={setGoalDate}
      wantsReminders={wantsReminders}
      onChangeWantsReminders={setWantsReminders}
      error={error}
      onClearError={() => setError(null)}
      loading={loading}
    />
  );

  const renderButtons = () => (
    <View style={styles.buttonContainer}>
      {currentStep > 1 && (
        <TouchableOpacity
          style={[styles.backButton]}
          onPress={handleBack}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>{t("intro.buttons.back")}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          styles.nextButton,
          currentStep === 1 &&
            (!username.trim() ||
              username.trim().length < 2 ||
              username.trim().length > 50) &&
            styles.nextButtonDisabled,
          currentStep === 2 &&
            (!yearlyGoal.trim() ||
              isNaN(Number(yearlyGoal)) ||
              Number(yearlyGoal) <= 0 ||
              Number(yearlyGoal) > 1000 ||
              !Number.isInteger(Number(yearlyGoal))) &&
            styles.nextButtonDisabled,
          currentStep === 4 &&
            (!dailyReadingGoal.trim() ||
              isNaN(Number(dailyReadingGoal)) ||
              Number(dailyReadingGoal) <= 0 ||
              Number(dailyReadingGoal) > 480) &&
            styles.nextButtonDisabled,
          currentStep === 5 &&
            (!targetDailyGoal.trim() ||
              isNaN(Number(targetDailyGoal)) ||
              Number(targetDailyGoal) <= 0 ||
              Number(targetDailyGoal) > 480 ||
              Number(targetDailyGoal) < Number(dailyReadingGoal) ||
              new Date(goalDate) < new Date(new Date().setHours(0, 0, 0, 0))) &&
            styles.nextButtonDisabled,
          loading && styles.nextButtonDisabled,
        ]}
        onPress={currentStep === 5 ? handleGetStarted : handleNext}
        // Only blocked while saving: tapping with invalid input shows the
        // validation message instead of a silently disabled button
        disabled={loading}
      >
        <Text style={styles.nextButtonText}>
          {loading
            ? t("intro.buttons.settingUp")
            : currentStep === 5
              ? t("intro.buttons.getStarted")
              : t("intro.buttons.continue")}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Image
              source={require("../assets/images/Logo.png")}
              style={styles.welcomeLogo}
              resizeMode="contain"
            />
            <Text style={styles.welcomeTitle}>
              {t("intro.appWelcome.title")}
            </Text>
            <Text style={styles.welcomeSubtitle}>
              {t("intro.appWelcome.subtitle")}
            </Text>
          </View>

          {renderProgressBar()}

          <View style={styles.card}>
            <Animated.View
              style={[
                styles.stepContainer,
                {
                  opacity: fadeAnimation,
                  transform: [{ translateY: slideAnimation }],
                },
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
              <Text style={styles.featuresTitle}>
                {t("intro.allSet.title")}
              </Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureEmoji}>📖</Text>
                  <Text style={styles.featureText}>
                    {t("intro.allSet.trackProgress")}
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureEmoji}>🎯</Text>
                  <Text style={styles.featureText}>
                    {t("intro.allSet.achieveGoal")}
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureEmoji}>📊</Text>
                  <Text style={styles.featureText}>
                    {t("intro.allSet.viewStats")}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <DataImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleRestoreSuccess}
      />
    </>
  );
}

const styles = introStyles;
