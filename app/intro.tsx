import { router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { execute } from "../db/db";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";

type Step = 1 | 2 | 3 | 4;

const MAX_YEARLY_GOAL = 1000;
const MAX_DAILY_MINUTES = 480;
const MS_IN_WEEK = 1000 * 60 * 60 * 24 * 7;

const getEndOfCurrentYearIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).toISOString();
};

const getWeeksRemaining = (targetDateIso: string) => {
  const now = new Date();
  const targetDate = new Date(targetDateIso);
  const diffMs = targetDate.getTime() - now.getTime();
  return Math.max(1, Math.ceil(diffMs / MS_IN_WEEK));
};

export default function IntroScreen() {
  const { t } = useTranslation();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [username, setUsername] = useState("");
  const [yearlyGoal, setYearlyGoal] = useState("");
  const [dailyReadingGoal, setDailyReadingGoal] = useState("");
  const [autoIncreaseEnabled, setAutoIncreaseEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slideAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;

  const trimmedUsername = username.trim();
  const yearlyGoalNum = Number(yearlyGoal);
  const dailyGoalNum = Number(dailyReadingGoal);

  const isStep1Valid = trimmedUsername.length >= 2 && trimmedUsername.length <= 50;
  const isStep2Valid =
    Number.isInteger(yearlyGoalNum) && yearlyGoalNum > 0 && yearlyGoalNum <= MAX_YEARLY_GOAL;
  const isStep3Valid =
    Number.isInteger(dailyGoalNum) && dailyGoalNum > 0 && dailyGoalNum <= MAX_DAILY_MINUTES;

  const animateStepTransition = (nextStep: Step) => {
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: -40,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentStep(nextStep);
      slideAnimation.setValue(40);

      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fadeAnimation, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnimation, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
  };

  const validateStep1 = () => {
    if (!trimmedUsername) {
      setError(t("intro.validation.nameRequired"));
      return false;
    }

    if (!isStep1Valid) {
      setError(t("intro.validation.nameInvalid"));
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    if (!yearlyGoal.trim()) {
      setError(t("intro.validation.goalRequired"));
      return false;
    }

    if (!Number.isFinite(yearlyGoalNum)) {
      setError(t("intro.validation.goalInvalid"));
      return false;
    }

    if (!Number.isInteger(yearlyGoalNum)) {
      setError(t("intro.validation.goalMustBeInteger"));
      return false;
    }

    if (!isStep2Valid) {
      setError(t("intro.validation.goalInvalid"));
      return false;
    }

    return true;
  };

  const validateStep3 = () => {
    if (!dailyReadingGoal.trim()) {
      setError(t("intro.validation.dailyGoalRequired"));
      return false;
    }

    if (!Number.isFinite(dailyGoalNum) || !Number.isInteger(dailyGoalNum)) {
      setError(t("intro.validation.dailyGoalInvalid"));
      return false;
    }

    if (dailyGoalNum <= 0 || dailyGoalNum > MAX_DAILY_MINUTES) {
      setError(t("intro.validation.dailyGoalInvalid"));
      return false;
    }

    return true;
  };

  const handleNext = () => {
    setError(null);

    if (currentStep === 1) {
      if (!validateStep1()) {
        return;
      }
      animateStepTransition(2);
      return;
    }

    if (currentStep === 2) {
      if (!validateStep2()) {
        return;
      }
      animateStepTransition(3);
      return;
    }

    if (currentStep === 3) {
      if (!validateStep3()) {
        return;
      }
      animateStepTransition(4);
    }
  };

  const handleBack = () => {
    setError(null);

    if (currentStep === 2) {
      animateStepTransition(1);
      return;
    }

    if (currentStep === 3) {
      animateStepTransition(2);
      return;
    }

    if (currentStep === 4) {
      animateStepTransition(3);
    }
  };

  const handleGetStarted = async () => {
    setError(null);

    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      return;
    }

    setLoading(true);

    try {
      const normalizedDailyGoal = dailyGoalNum;
      const normalizedYearlyGoal = yearlyGoalNum;
      const targetDailyGoal = autoIncreaseEnabled
        ? normalizedDailyGoal * 2
        : normalizedDailyGoal;
      const targetGoalDateIso = autoIncreaseEnabled
        ? getEndOfCurrentYearIso()
        : null;
      const weeksRemaining = targetGoalDateIso
        ? getWeeksRemaining(targetGoalDateIso)
        : 1;
      const weeklyIncreaseMinutes =
        autoIncreaseEnabled && targetDailyGoal > normalizedDailyGoal
          ? Math.ceil((targetDailyGoal - normalizedDailyGoal) / weeksRemaining)
          : 0;
      const weeklyIncreasePercentage =
        normalizedDailyGoal > 0
          ? (weeklyIncreaseMinutes / normalizedDailyGoal) * 100
          : 0;

      await execute(
        `INSERT OR REPLACE INTO user_preferences (
          id,
          username,
          yearly_book_goal,
          updated_at,
          weekly_reading_goal,
          initial_reading_rate_minutes_per_day,
          end_reading_rate_goal_minutes_per_day,
          end_reading_rate_goal_date,
          current_reading_rate_minutes_per_day,
          current_reading_rate_last_updated,
          weekly_reading_rate_increase_minutes,
          weekly_reading_rate_increase_minutes_percentage,
          auto_increase_enabled
        ) VALUES (1, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trimmedUsername,
          normalizedYearlyGoal,
          normalizedDailyGoal * 7,
          normalizedDailyGoal,
          targetDailyGoal,
          targetGoalDateIso,
          normalizedDailyGoal,
          new Date().toISOString(),
          weeklyIncreaseMinutes,
          weeklyIncreasePercentage,
          autoIncreaseEnabled ? 1 : 0,
        ],
      );

      await NotificationService.getNotificationPreferences();

      Keyboard.dismiss();
      router.replace("/(tabs)/(home)");
    } catch (saveError) {
      console.error("Error saving onboarding preferences:", saveError);
      setError(t("intro.validation.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map((step) => (
        <View key={step} style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressDot,
              currentStep >= step && styles.progressDotActive,
              currentStep === step && styles.progressDotCurrent,
            ]}
          />
          {step < 4 && (
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
            setUsername(text.slice(0, 50));
            if (error && text.trim().length >= 2 && text.trim().length <= 50) {
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
        <Text style={styles.stepTitle}>
          {t("intro.goal.title", { username: trimmedUsername || "..." })}
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
            const numericText = text.replace(/[^0-9]/g, "");
            if (numericText.length <= 4) {
              setYearlyGoal(numericText);
              if (
                error &&
                numericText &&
                Number.isInteger(Number(numericText)) &&
                Number(numericText) > 0 &&
                Number(numericText) <= MAX_YEARLY_GOAL
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
        <Text style={styles.stepEmoji}>⏰</Text>
        <Text style={styles.stepTitle}>{t("intro.currentReading.title")}</Text>
        <Text style={styles.stepSubtitle}>{t("intro.currentReading.subtitle")}</Text>
      </View>

      <View style={styles.goalContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder={t("intro.currentReading.placeholder")}
          placeholderTextColor={COLORS.neutral[400]}
          value={dailyReadingGoal}
          onChangeText={(text) => {
            const numericText = text.replace(/[^0-9]/g, "");
            if (numericText.length <= 4) {
              setDailyReadingGoal(numericText);
              if (
                error &&
                numericText &&
                Number.isInteger(Number(numericText)) &&
                Number(numericText) > 0 &&
                Number(numericText) <= MAX_DAILY_MINUTES
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

      <View style={styles.autoIncreaseCard}>
        <View style={styles.autoIncreaseTextContainer}>
          <Text style={styles.autoIncreaseTitle}>
            {t("intro.currentReading.autoIncreaseTitle")}
          </Text>
          <Text style={styles.autoIncreaseDescription}>
            {t("intro.currentReading.autoIncreaseDescription")}
          </Text>
          {dailyReadingGoal ? (
            <Text style={styles.autoIncreasePreview}>
              {t("intro.currentReading.autoIncreasePreview", {
                target: Number(dailyReadingGoal) * 2,
              })}
            </Text>
          ) : null}
        </View>

        <Switch
          value={autoIncreaseEnabled}
          onValueChange={setAutoIncreaseEnabled}
          disabled={loading}
          trackColor={{
            false: COLORS.neutral[200],
            true: COLORS.state.primarySoft,
          }}
          thumbColor={
            autoIncreaseEnabled ? COLORS.accent.primary : COLORS.neutral[400]
          }
        />
      </View>
    </>
  );

  const renderStep4 = () => {
    const summaryTarget = dailyGoalNum > 0 ? dailyGoalNum * 2 : 0;

    return (
      <>
        <View style={styles.stepHeader}>
          <Text style={styles.stepEmoji}>🚀</Text>
          <Text style={styles.stepTitle}>{t("intro.summary.title")}</Text>
          <Text style={styles.stepSubtitle}>{t("intro.summary.subtitle")}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("intro.summary.username")}</Text>
            <Text style={styles.summaryValue}>{trimmedUsername}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("intro.summary.yearlyGoal")}</Text>
            <Text style={styles.summaryValue}>
              {yearlyGoalNum} {t("intro.goal.label")}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("intro.summary.dailyGoal")}</Text>
            <Text style={styles.summaryValue}>
              {dailyGoalNum} {t("intro.currentReading.label")}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("intro.summary.autoIncrease")}</Text>
            <Text style={styles.summaryValue}>
              {autoIncreaseEnabled
                ? t("intro.summary.autoIncreaseOn")
                : t("intro.summary.autoIncreaseOff")}
            </Text>
          </View>

          {autoIncreaseEnabled && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("intro.summary.targetGoal")}</Text>
                <Text style={styles.summaryValue}>
                  {summaryTarget} {t("intro.currentReading.label")}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("intro.summary.targetDate")}</Text>
                <Text style={styles.summaryValue}>{t("intro.summary.yearEnd")}</Text>
              </View>
            </>
          )}
        </View>
      </>
    );
  };

  const renderButtons = () => {
    const isDisabled =
      loading ||
      (currentStep === 1 && !isStep1Valid) ||
      (currentStep === 2 && !isStep2Valid) ||
      (currentStep === 3 && !isStep3Valid);

    return (
      <View style={styles.buttonContainer}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>{t("intro.buttons.back")}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.nextButton, isDisabled && styles.nextButtonDisabled]}
          onPress={currentStep === 4 ? handleGetStarted : handleNext}
          disabled={isDisabled}
        >
          <Text style={styles.nextButtonText}>
            {loading
              ? t("intro.buttons.settingUp")
              : currentStep === 4
                ? t("intro.buttons.getStarted")
                : t("intro.buttons.continue")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
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
          <Text style={styles.welcomeTitle}>{t("intro.appWelcome.title")}</Text>
          <Text style={styles.welcomeSubtitle}>{t("intro.appWelcome.subtitle")}</Text>
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
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {renderButtons()}
        </View>

        {currentStep === 4 && (
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>{t("intro.features.title")}</Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Text style={styles.featureEmoji}>📖</Text>
                <Text style={styles.featureText}>
                  {t("intro.features.trackProgress")}
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureEmoji}>🎯</Text>
                <Text style={styles.featureText}>
                  {t("intro.features.achieveGoal")}
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureEmoji}>📊</Text>
                <Text style={styles.featureText}>
                  {t("intro.features.viewStatistics")}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    minHeight: "100%",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  welcomeLogo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.neutral[800],
    textAlign: "center",
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: COLORS.neutral[500],
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.neutral[200],
    borderWidth: 2,
    borderColor: COLORS.neutral[200],
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  progressDotCurrent: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    transform: [{ scale: 1.2 }],
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.neutral[200],
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 24,
    minHeight: 320,
  },
  stepContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  stepHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  stepEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.neutral[800],
    textAlign: "center",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: COLORS.neutral[500],
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  inputContainer: {
    width: "100%",
    alignItems: "center",
  },
  input: {
    width: "100%",
    height: 56,
    borderColor: COLORS.neutral[200],
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    fontSize: 18,
    color: COLORS.neutral[800],
    textAlign: "center",
    fontWeight: "500",
  },
  goalContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  goalInput: {
    width: 120,
    height: 56,
    borderColor: COLORS.neutral[200],
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    fontSize: 24,
    color: COLORS.neutral[800],
    textAlign: "center",
    fontWeight: "bold",
    marginRight: 16,
  },
  goalLabel: {
    fontSize: 18,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  goalHint: {
    fontSize: 14,
    color: COLORS.neutral[500],
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 4,
    paddingHorizontal: 10,
  },
  autoIncreaseCard: {
    marginTop: 20,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface.page,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  autoIncreaseTextContainer: {
    flex: 1,
    gap: 4,
  },
  autoIncreaseTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.neutral[800],
  },
  autoIncreaseDescription: {
    fontSize: 13,
    color: COLORS.neutral[500],
    lineHeight: 18,
  },
  autoIncreasePreview: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
  },
  summaryCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
    backgroundColor: COLORS.surface.page,
    padding: 14,
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.neutral[500],
    fontWeight: "600",
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.neutral[800],
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  error: {
    color: COLORS.danger,
    textAlign: "center",
    marginTop: 16,
    fontSize: 14,
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    gap: 16,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: COLORS.neutral[50],
    borderWidth: 1.5,
    borderColor: COLORS.neutral[200],
    flex: 1,
  },
  backButtonText: {
    color: COLORS.neutral[500],
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    flex: 2,
  },
  nextButtonDisabled: {
    backgroundColor: COLORS.neutral[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  featuresContainer: {
    alignItems: "center",
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.neutral[500],
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: COLORS.black,
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
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
});
