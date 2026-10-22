import { router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
<<<<<<< HEAD
  AccessibilityInfo,
  Animated,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RestoreSheet, { chooseBackup } from "../components/settings/RestoreSheet";
import {
  DailyGoalStep,
  FirstBookStep,
  GrowStep,
  NameStep,
  ReminderStep,
} from "../components/intro/OnboardingSteps";
import Button from "../components/ui/Button";
import Eyebrow from "../components/ui/Eyebrow";
import ProgressRule from "../components/ui/ProgressRule";
import Screen from "../components/ui/Screen";
import { useSessionSheets } from "../contexts/SessionSheetsContext";
import { BookWithStats, listBooksWithStats } from "../db/repos/books";
import {
  getUserPreferences,
  saveOnboardingPreferences,
} from "../db/repos/preferences";
import { useFocusRefresh } from "../hooks/useFocusRefresh";
import type { BackupPreview } from "../services/dataBackupService";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import { SPACING } from "../themes/spacing";
import { TYPE } from "../themes/typography";
import { dateToLocalDateString } from "../utils/dateUtils";
import {
  applyWeeklyGoalGrowth,
  computeGrowthGoalFields,
} from "../utils/goalSettings";

type Step = 1 | 2 | 3 | 4 | 5;
const TOTAL_STEPS = 5;
const MAX_MINUTES = 480;
=======
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
import GoalIncreaseCriteriaCard from "../components/reading/GoalIncreaseCriteriaCard";
import { execute } from "../db/db";
import notificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import { evaluateWeeklyConsistency } from "../utils/goalIncrease";

type Step = 1 | 2 | 3 | 4;

const MAX_YEARLY_GOAL = 1000;
const MAX_DAILY_MINUTES = 480;
const MS_IN_WEEK = 1000 * 60 * 60 * 24 * 7;
const REQUIRED_GOAL_MET_DAYS = evaluateWeeklyConsistency(0).requiredGoalMetDays;
const CONSISTENCY_WINDOW_DAYS = 7;

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
>>>>>>> origin/xccBuild

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

/** A target a step or two above today's goal, rounded to 5 minutes */
const suggestTarget = (daily: number) =>
  Math.min(MAX_MINUTES, Math.max(daily + 10, Math.round((daily * 1.5) / 5) * 5));

/** The stored date format the goal helpers accept (DD/MM/YYYY, local) */
const toFormDate = (date: Date) => {
  const [year, month, day] = dateToLocalDateString(date).split("-");
  return `${day}/${month}/${year}`;
};

/**
 * Onboarding: name (or restore a backup) → today's daily goal → grow it toward a
 * target? → reminder opt-in → (profile saved) optional "what are you reading?".
 * New users start with no yearly goal (0); Progress offers to set one.
 */
export default function IntroScreen() {
  const { t } = useTranslation();
<<<<<<< HEAD
  const insets = useSafeAreaInsets();
  const { openAddBook } = useSessionSheets();
  const [step, setStep] = useState<Step>(1);
  const [username, setUsername] = useState("");
  const [daily, setDaily] = useState("20");
  const [grow, setGrow] = useState(true);
  const [target, setTarget] = useState("");
  const [targetTouched, setTargetTouched] = useState(false);
  // At least one weekly step before the date; three months out by default
  const minimumDate = addDays(7);
  const maximumDate = addDays(5 * 365);
  const [goalDate, setGoalDate] = useState(() => addDays(91));
  const [wantsReminders, setWantsReminders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backup, setBackup] = useState<BackupPreview | null>(null);
  const [books, setBooks] = useState<BookWithStats[]>([]);
  const [keyboardShown, setKeyboardShown] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  // Taps during a step change or a save are ignored (state updates lag a frame)
  const transitioning = useRef(false);
  const savingRef = useRef(false);

  const dailyNumber = Number(daily);
  const targetNumber = Number(target);
  // At the 480-minute cap there's nothing to grow into
  const canGrow = dailyNumber < MAX_MINUTES;
  const growing = grow && canGrow;
  const weeklyIncrease =
    growing && dailyNumber > 0 && targetNumber > dailyNumber
      ? computeGrowthGoalFields({
          currentDailyGoal: dailyNumber,
          targetDailyGoal: targetNumber,
          targetDate: toFormDate(goalDate),
        }).weeklyIncreaseMinutes
      : 0;

  // The books added on the last step (a new install has no others)
  const loadBooks = async () => {
    if (step !== 5) return;
    try {
      setBooks(await listBooksWithStats());
    } catch (e) {
      console.error("Error loading books:", e);
    }
  };
  useFocusRefresh(loadBooks, ["books"], [step]);

  const goTo = (next: Step) => {
    if (transitioning.current) return;
    transitioning.current = true;
    setError(null);
    Animated.timing(fade, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setStep(next);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      Animated.timing(fade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        transitioning.current = false;
=======

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
>>>>>>> origin/xccBuild
      });
    });
  };

<<<<<<< HEAD
  // Android back steps back through onboarding (there's no screen behind it);
  // once the profile is saved (step 5) it leaves the app as usual
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step < 2 || step > 4 || savingRef.current) return false;
      goTo((step - 1) as Step);
      return true;
    });
    return () => subscription.remove();
    // goTo only reads refs and setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // The footer drops its home-indicator padding while the keyboard is up
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardShown(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardShown(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // iOS has no live regions: announce validation errors
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  const validDaily = Number.isInteger(dailyNumber) && dailyNumber >= 1 && dailyNumber <= MAX_MINUTES;
  const validTarget =
    !growing || (targetNumber > dailyNumber && targetNumber <= MAX_MINUTES);

  const finishSetup = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const plan = computeGrowthGoalFields({
        currentDailyGoal: dailyNumber,
        targetDailyGoal: growing ? targetNumber : dailyNumber,
        // Keeping the goal: no target date (the helper fills in the year's end)
        targetDate: growing ? toFormDate(goalDate) : null,
      });
      await saveOnboardingPreferences({
        username: username.trim(),
        yearlyBookGoal: 0,
        initialRate: plan.initialReadingRate,
        targetRate: plan.targetReadingRate,
        targetDate: plan.endGoalDate,
        weeklyIncreaseMinutes: plan.weeklyIncreaseMinutes,
        weeklyIncreasePercentage: plan.weeklyIncreasePercentage,
      });
    } catch (e) {
      console.error("Error saving preferences:", e);
      setError(t("intro.validation.saveFailed"));
      savingRef.current = false;
      setSaving(false);
      return;
    }

    // Reminders: ask for permission now, with context, and only if the user
    // wants them (never at first launch). Failures here must not block
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
    goTo(5);
    // Buttons stay disabled until step 5 has replaced step 4
    setTimeout(() => {
      savingRef.current = false;
      setSaving(false);
    }, 160);
=======
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
>>>>>>> origin/xccBuild
  };

  const handleNext = () => {
    if (transitioning.current || savingRef.current) return;
    setError(null);
<<<<<<< HEAD
    if (step === 1) {
      const name = username.trim();
      if (name.length < 2 || name.length > 50) {
        setError(t("intro.validation.nameInvalid"));
        return;
      }
      goTo(2);
    } else if (step === 2) {
      if (!validDaily) {
        setError(t("intro.validation.dailyRange"));
        return;
      }
      // Suggest a target from the goal just chosen, unless one was typed
      if (!targetTouched || targetNumber <= dailyNumber) {
        setTarget(String(suggestTarget(dailyNumber)));
        setTargetTouched(false);
      }
      Keyboard.dismiss();
      goTo(3);
    } else if (step === 3) {
      if (!validTarget) {
        setError(t("intro.validation.targetRange", { minutes: dailyNumber }));
        return;
      }
      Keyboard.dismiss();
      goTo(4);
    } else if (step === 4) {
      finishSetup();
    }
  };

  const restoreBackup = async () => {
    const chosen = await chooseBackup(t);
    if (chosen) setBackup(chosen);
  };

  const handleRestoreSuccess = async () => {
    setBackup(null);
    try {
      // The restored plan may be weeks old: catch up its goal before Today loads
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
        setError(t("intro.name.restoreNoProfile"));
      }
    } catch (e) {
      console.error("Error after restoring backup:", e);
      setError(t("intro.name.restoreFailed"));
    }
  };

  const enterApp = () => router.replace("/(tabs)/(home)");
  const findBook = () =>
    openAddBook({ status: "currently_reading", closeOnAdd: true });

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.top, { paddingTop: insets.top + SPACING[4] }]}>
          {step === 1 ? (
            <View style={styles.brand}>
              <Image
                source={require("../assets/images/Logo.png")}
                style={styles.logo}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <Text style={styles.wordmark}>PageStreak</Text>
            </View>
          ) : (
            <Eyebrow>{t("intro.step", { step, total: TOTAL_STEPS })}</Eyebrow>
          )}
          <ProgressRule progress={step / TOTAL_STEPS} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.step, { opacity: fade }]}>
            {step === 1 && (
              <NameStep
                name={username}
                onChange={(value) => {
                  setUsername(value);
                  if (error && value.trim().length >= 2) setError(null);
                }}
                onSubmit={handleNext}
                onRestore={restoreBackup}
                disabled={saving}
              />
            )}
            {step === 2 && (
              <DailyGoalStep
                minutes={daily}
                onChange={(value) => {
                  setDaily(value);
                  setError(null);
                }}
                onSubmit={handleNext}
              />
            )}
            {step === 3 && (
              <GrowStep
                daily={dailyNumber}
                grow={growing}
                canGrow={canGrow}
                onChangeGrow={(value) => {
                  setGrow(value);
                  setError(null);
                }}
                target={target}
                onChangeTarget={(value) => {
                  setTarget(value);
                  setTargetTouched(true);
                  setError(null);
                }}
                goalDate={goalDate}
                onChangeGoalDate={setGoalDate}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                weeklyIncrease={weeklyIncrease}
              />
            )}
            {step === 4 && (
              <ReminderStep
                wantsReminders={wantsReminders}
                onChange={setWantsReminders}
              />
            )}
            {step === 5 && <FirstBookStep books={books} />}

            {error && (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            )}
          </Animated.View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: keyboardShown
                ? SPACING[3]
                : Math.max(insets.bottom, SPACING[4]),
            },
          ]}
        >
          {step === 5 ? (
            books.length > 0 ? (
              <>
                <Button
                  title={t("intro.firstBook.addAnother")}
                  variant="secondary"
                  onPress={findBook}
                />
                <Button
                  title={t("intro.firstBook.start")}
                  onPress={enterApp}
                  grow
                />
              </>
            ) : (
              <>
                <Button
                  title={t("intro.firstBook.skip")}
                  variant="secondary"
                  onPress={enterApp}
                />
                <Button
                  title={t("intro.firstBook.find")}
                  icon="search"
                  onPress={findBook}
                  grow
                />
              </>
            )
          ) : (
            <>
              {step > 1 && (
                <Button
                  title={t("intro.buttons.back")}
                  variant="secondary"
                  onPress={() => goTo((step - 1) as Step)}
                  disabled={saving}
                />
              )}
              <Button
                title={saving ? t("intro.buttons.settingUp") : t("intro.buttons.continue")}
                onPress={handleNext}
                loading={saving}
                grow
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <RestoreSheet
        backup={backup}
        onClose={() => setBackup(null)}
        onRestored={handleRestoreSuccess}
      />
    </Screen>
=======

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

      await notificationService.getNotificationPreferences();

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

      <View style={styles.criteriaCardContainer}>
        <GoalIncreaseCriteriaCard
          autoIncreaseEnabled={autoIncreaseEnabled}
          currentDailyGoal={dailyGoalNum > 0 ? dailyGoalNum : null}
          goalMetDays={0}
          activeDays={0}
          requiredGoalMetDays={REQUIRED_GOAL_MET_DAYS}
          windowDays={CONSISTENCY_WINDOW_DAYS}
          showProgress={false}
          isNewUser
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
>>>>>>> origin/xccBuild
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
<<<<<<< HEAD
  top: {
    paddingHorizontal: SPACING[5],
    gap: SPACING[3],
  },
  brand: {
=======
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
>>>>>>> origin/xccBuild
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
  },
  // The app icon (its tinted square is part of the image): round it like one
  logo: {
    width: 30,
    height: 30,
    borderRadius: 7,
  },
  wordmark: {
    ...TYPE.headline,
    fontSize: 19,
  },
  content: {
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[6],
    paddingBottom: SPACING[6],
  },
<<<<<<< HEAD
  step: {
    gap: SPACING[5],
=======
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
  criteriaCardContainer: {
    marginTop: 10,
    width: "100%",
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
>>>>>>> origin/xccBuild
  },
  error: {
    ...TYPE.meta,
    color: COLORS.destructive.ink,
  },
  footer: {
    flexDirection: "row",
<<<<<<< HEAD
    gap: SPACING[3],
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[3],
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
=======
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
>>>>>>> origin/xccBuild
  },
});
