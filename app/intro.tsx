import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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
      });
    });
  };

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
  };

  const handleNext = () => {
    if (transitioning.current || savingRef.current) return;
    setError(null);
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
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  top: {
    paddingHorizontal: SPACING[5],
    gap: SPACING[3],
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
  },
  logo: {
    width: 28,
    height: 28,
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
  step: {
    gap: SPACING[5],
  },
  error: {
    ...TYPE.meta,
    color: COLORS.destructive.ink,
  },
  footer: {
    flexDirection: "row",
    gap: SPACING[3],
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[3],
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
  },
});
