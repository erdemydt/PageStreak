<<<<<<< HEAD
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
=======
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  Image,
>>>>>>> origin/xccBuild
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
<<<<<<< HEAD
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TimerClock from "../../../components/TimerClock";
import SessionRow from "../../../components/session/SessionRow";
import WeekStrip from "../../../components/today/WeekStrip";
import BookCover from "../../../components/ui/BookCover";
import Button from "../../../components/ui/Button";
import Eyebrow from "../../../components/ui/Eyebrow";
import Hairline from "../../../components/ui/Hairline";
import OptionSheet from "../../../components/ui/OptionSheet";
import ProgressRule from "../../../components/ui/ProgressRule";
import { StatusBarBand } from "../../../components/ui/Screen";
import SettingsButton from "../../../components/ui/SettingsButton";
import { useSessionSheets } from "../../../contexts/SessionSheetsContext";
import { BookWithStats, listBooksWithStats } from "../../../db/repos/books";
import { getUserPreferences } from "../../../db/repos/preferences";
import {
  listSessionsWithBooks,
  SessionWithBook,
} from "../../../db/repos/sessions";
import { useBookStatusChange } from "../../../hooks/useBookStatusChange";
import { useFocusRefresh } from "../../../hooks/useFocusRefresh";
=======

import BookCard from "../../../components/books/BookCard";
import DailyProgressCard from "../../../components/reading/DailyProgressCard";
import GoalIncreaseCriteriaCard from "../../../components/reading/GoalIncreaseCriteriaCard";
import ReadingTimeLogger from "../../../components/reading/ReadingTimeLogger";
import type { EnhancedBook } from "../../../db/db";
import { useGoalIncrease } from "../../../hooks/useGoalIncrease";
import { useGoalIncreaseCriteria } from "../../../hooks/useGoalIncreaseCriteria";
import { useReadingStats } from "../../../hooks/useReadingStats";
>>>>>>> origin/xccBuild
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { FONTS, TYPE } from "../../../themes/typography";
import type { UserPreferences } from "../../../types/models";
import {
<<<<<<< HEAD
  dateToLocalDateString,
  getTodayDateString,
  parseDbDate,
} from "../../../utils/dateUtils";
import {
  formatDate,
  formatDuration,
  formatSessionDetail,
} from "../../../utils/format";
import {
  computeBookProgress,
  getReadingStreak,
} from "../../../utils/readingProgress";
import {
  clearReadingTimer,
  getElapsedMinutes,
  getElapsedMs,
  getReadingTimer,
  ReadingTimerState,
  startReadingTimer,
  stopReadingTimer,
} from "../../../utils/readingTimer";
import { showToast } from "../../../utils/toast";
import { loadWeek, WeekDay } from "../../../utils/week";

// Shorter timed stops are treated as accidental; longer ones ask first
const MIN_TIMED_MS = 30 * 1000;
const LONG_TIMER_MS = 4 * 60 * 60 * 1000;
// Above this, the yearly line shows a rule instead of one spine per book
const MAX_SPINES = 60;

export default function TodayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { openLogger, editSession, openAddBook } = useSessionSheets();
  const setBookStatus = useBookStatusChange();
  const [choosing, setChoosing] = useState(false);

  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [books, setBooks] = useState<BookWithStats[]>([]);
  const [week, setWeek] = useState<WeekDay[]>([]);
  const [streak, setStreak] = useState(0);
  const [todaySessions, setTodaySessions] = useState<SessionWithBook[]>([]);
  const [timer, setTimer] = useState<ReadingTimerState | null>(null);
  const [pickedBookId, setPickedBookId] = useState<number | null>(null);

  const loadData = async () => {
    try {
      const today = getTodayDateString();
      // One failing part must not blank the whole screen
      const orFallback = <T,>(promise: Promise<T>, fallback: T) =>
        promise.catch((error) => {
          console.error("Failed to load part of Today:", error);
          return fallback;
        });
      const [user, allBooks, weekDays, streakDays, sessions, timerState] =
        await Promise.all([
          orFallback(getUserPreferences(), null),
          // Most recently read first: the first book in progress is the one shown
          orFallback(listBooksWithStats({ order: "active" }), []),
          orFallback(loadWeek(today), []),
          orFallback(getReadingStreak(), 0),
          orFallback(listSessionsWithBooks(today, today), []),
          orFallback(getReadingTimer(), null),
        ]);
      setPrefs(user);
      setBooks(allBooks);
      setWeek(weekDays);
      setStreak(streakDays);
      setTodaySessions(sessions);
      setTimer(timerState);
    } catch (e) {
      console.error("Failed to load Today:", e);
=======
  clearGoalIncreaseBannerEvent,
  clearGoalIncreaseProposalEvent,
  clearGoalIncreaseSnoozeUntil,
  loadGoalIncreaseBannerEvent,
  loadGoalIncreaseProposalEvent,
  saveGoalIncreaseBannerEvent,
  saveGoalIncreaseSnoozeUntil,
  type GoalIncreaseBannerEvent,
  type GoalIncreaseProposalEvent,
} from "../../../utils/goalIncreaseEvents";

const GOAL_INCREASE_SNOOZE_DAYS = 7;

export default function HomeScreen() {
  const { t } = useTranslation();
  const { applyGoalIncreaseProposal } = useGoalIncrease();
  const {
    loading: criteriaLoading,
    hasUserPreferences,
    autoIncreaseEnabled,
    currentDailyGoal,
    goalMetDays,
    activeDays,
    requiredGoalMetDays,
    windowDays,
    reloadCriteria,
  } = useGoalIncreaseCriteria();
  const {
    books,
    userPreferences,
    todayMinutes,
    refreshTrigger,
    booksRead,
    currentlyReading,
    wantToRead,
    yearlyGoal,
    progressPercentage,
    currentBook,
    loadData,
    initializeStats,
    handleReadingLoggerSuccess,
  } = useReadingStats();
  const [goalIncreaseBanner, setGoalIncreaseBanner] =
    useState<GoalIncreaseBannerEvent | null>(null);
  const [goalIncreaseProposal, setGoalIncreaseProposal] =
    useState<GoalIncreaseProposalEvent | null>(null);
  const [showReadingLogger, setShowReadingLogger] = useState(false);
  const lastPromptedProposalRef = useRef<string | null>(null);

  // Load data on mount and when screen comes into focus
  useEffect(() => {
    initializeStats();
  }, [initializeStats]);

  // Refresh data when screen comes into focus (e.g., when returning from books tab)
  useFocusEffect(
    useCallback(() => {
      loadData();
      loadGoalIncreaseBanner();
      loadGoalIncreaseProposal();
    }, [loadData]),
  );

  const loadGoalIncreaseBanner = async () => {
    try {
      const event = await loadGoalIncreaseBannerEvent();
      setGoalIncreaseBanner(event);
    } catch (error) {
      console.error("Failed to load goal increase banner event:", error);
      setGoalIncreaseBanner(null);
    }
  };

  const loadGoalIncreaseProposal = async () => {
    try {
      const proposal = await loadGoalIncreaseProposalEvent();
      setGoalIncreaseProposal(proposal);
    } catch (error) {
      console.error("Failed to load goal increase proposal event:", error);
      setGoalIncreaseProposal(null);
    }
  };

  const dismissGoalIncreaseBanner = async () => {
    setGoalIncreaseBanner(null);

    try {
      await clearGoalIncreaseBannerEvent();
    } catch (error) {
      console.error("Failed to clear goal increase banner event:", error);
    }
  };

  const handleDeclineGoalIncrease = useCallback(async () => {
    setGoalIncreaseProposal(null);

    try {
      const snoozeUntil = new Date();
      snoozeUntil.setDate(snoozeUntil.getDate() + GOAL_INCREASE_SNOOZE_DAYS);

      await Promise.all([
        clearGoalIncreaseProposalEvent(),
        saveGoalIncreaseSnoozeUntil(snoozeUntil.toISOString()),
      ]);
    } catch (error) {
      console.error("Failed to snooze goal increase proposal:", error);
    }
  }, []);

  const handleConfirmGoalIncrease = useCallback(async () => {
    if (!goalIncreaseProposal) {
      return;
    }

    try {
      const result = await applyGoalIncreaseProposal(goalIncreaseProposal);

      if (result.applied && result.oldGoal && result.newGoal) {
        await Promise.all([
          clearGoalIncreaseProposalEvent(),
          clearGoalIncreaseSnoozeUntil(),
          saveGoalIncreaseBannerEvent({
            oldGoal: result.oldGoal,
            newGoal: result.newGoal,
            timestamp: result.checkedAt,
          }),
        ]);

        setGoalIncreaseProposal(null);
        await Promise.all([loadGoalIncreaseBanner(), loadData(), reloadCriteria()]);
        return;
      }

      setGoalIncreaseProposal(null);
      await clearGoalIncreaseProposalEvent();

      Alert.alert(
        t("home.goalIncreasePrompt.outdatedTitle"),
        t("home.goalIncreasePrompt.outdatedBody"),
      );
    } catch (error) {
      console.error("Failed to confirm goal increase proposal:", error);
      Alert.alert(
        t("home.goalIncreasePrompt.errorTitle"),
        t("home.goalIncreasePrompt.errorBody"),
      );
>>>>>>> origin/xccBuild
    }
  }, [
    applyGoalIncreaseProposal,
    goalIncreaseProposal,
    loadData,
    reloadCriteria,
    t,
  ]);

<<<<<<< HEAD
  // Reload on focus, and when books/sessions/preferences change underneath
  // (e.g. the log sheet saving a session)
  useFocusRefresh(loadData, ["books", "sessions", "preferences"]);

  const reading = books.filter(
    (book) => book.reading_status === "currently_reading",
  );
  // With nothing in progress: pick from the want-to-read list, else add one
  const upNext = books.filter((book) => book.reading_status === "want_to_read");
  const hasUpNext = upNext.length > 0;
  // A timer is always shown under the book it's timing
  const shownBook =
    reading.find((book) => book.id === timer?.bookId) ??
    reading.find((book) => book.id === pickedBookId) ??
    reading[0] ??
    null;
=======
  useEffect(() => {
    if (!goalIncreaseProposal) {
      return;
    }

    const proposalKey = `${goalIncreaseProposal.oldGoal}-${goalIncreaseProposal.newGoal}-${goalIncreaseProposal.checkedAt}`;
    if (lastPromptedProposalRef.current === proposalKey) {
      return;
    }

    lastPromptedProposalRef.current = proposalKey;

    Alert.alert(
      t("home.goalIncreasePrompt.title"),
      t("home.goalIncreasePrompt.body", {
        oldGoal: goalIncreaseProposal.oldGoal,
        newGoal: goalIncreaseProposal.newGoal,
      }),
      [
        {
          text: t("home.goalIncreasePrompt.notNow"),
          style: "cancel",
          onPress: () => {
            handleDeclineGoalIncrease();
          },
        },
        {
          text: t("home.goalIncreasePrompt.confirm"),
          onPress: () => {
            handleConfirmGoalIncrease();
          },
        },
      ],
      { cancelable: true },
    );
  }, [
    goalIncreaseProposal,
    handleConfirmGoalIncrease,
    handleDeclineGoalIncrease,
    t,
  ]);
>>>>>>> origin/xccBuild

  const todayEntry = week.find((day) => day.state === "today");
  const todayMinutes = todayEntry?.minutes ?? 0;
  const dailyGoal =
    todayEntry?.goal || prefs?.current_reading_rate_minutes_per_day || 30;
  const remaining = Math.max(0, dailyGoal - todayMinutes);

  const statusLine =
    remaining === 0
      ? t("today.goalMet")
      : streak > 0
        ? t("today.keepStreak", { time: formatDuration(remaining) })
        : todayMinutes > 0
          ? t("today.toGoal", { time: formatDuration(remaining) })
          : t("today.start");

  // Yearly goal: books finished this calendar year (0 = no goal set)
  const currentYear = new Date().getFullYear();
  const finishedThisYear = books.filter(
    (book) =>
      book.reading_status === "read" &&
      parseDbDate(book.date_finished)?.getFullYear() === currentYear,
  );
  const yearlyGoal = prefs?.yearly_book_goal || 0;

<<<<<<< HEAD
  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? t("today.greetingMorning")
      : hour >= 12 && hour < 17
        ? t("today.greetingAfternoon")
        : t("today.greetingEvening");

  const openBook = (bookId: number) =>
    router.push({
      pathname: "/(tabs)/(home)/book/[id]",
      params: { id: bookId.toString() },
    });

  // Guards against double taps (Start and Stop share a spot on the screen)
  const timerBusy = useRef(false);
  const withTimerLock = async (action: () => Promise<void>) => {
    if (timerBusy.current) return;
    timerBusy.current = true;
    try {
      await action();
    } catch (error) {
      console.error("Reading timer error:", error);
    } finally {
      timerBusy.current = false;
    }
  };

  const discardTimer = async () => {
    await clearReadingTimer();
    setTimer(null);
  };

  // A timed session that got logged is done; a cancelled log keeps the
  // stopped timer on screen so the minutes aren't lost
  const openLoggerFromTimer = (state: ReadingTimerState) => {
    // A timer started before today logs to the day it started
    const startDate = dateToLocalDateString(new Date(state.startedAt));
    openLogger({
      bookId: state.bookId,
      minutes: getElapsedMinutes(state),
      date: startDate < getTodayDateString() ? startDate : undefined,
      onSuccess: () => withTimerLock(discardTimer),
    });
  };

  const handleStartTimer = () =>
    withTimerLock(async () => {
      setTimer(await startReadingTimer(shownBook?.id));
    });

  const handleStopTimer = () =>
    withTimerLock(async () => {
      const stopped = await stopReadingTimer();
      setTimer(stopped);
      if (!stopped) return;

      const elapsedMs = getElapsedMs(stopped);
      if (elapsedMs < MIN_TIMED_MS) {
        // An accidental start/stop isn't a reading session
        await discardTimer();
        showToast({ message: t("home.timer.tooShort") });
        return;
      }
      if (elapsedMs > LONG_TIMER_MS) {
        // Probably forgotten: ask before pre-filling hours of reading
        Alert.alert(
          t("home.timer.longTitle"),
          t("home.timer.longMessage", {
            hours: Math.floor(elapsedMs / (60 * 60 * 1000)),
          }),
          [
            {
              text: t("home.timer.discard"),
              style: "destructive",
              onPress: () => withTimerLock(discardTimer),
            },
            {
              text: t("home.timer.review"),
              onPress: () => openLoggerFromTimer(stopped),
            },
          ],
        );
        return;
      }
      openLoggerFromTimer(stopped);
    });

  const handleDiscardTimer = () => {
    Alert.alert(t("home.timer.discardTitle"), t("home.timer.discardMessage"), [
      { text: t("booksPage.alert.cancel"), style: "cancel" },
      {
        text: t("home.timer.discard"),
        style: "destructive",
        onPress: () => withTimerLock(discardTimer),
      },
    ]);
  };

  const renderTimer = (state: ReadingTimerState) =>
    state.stoppedAt ? (
      <View style={styles.actionRow}>
        <Text style={styles.timerReady}>
          {t("home.timer.ready", { minutes: getElapsedMinutes(state) })}
        </Text>
        <Button
          title={t("home.timer.discard")}
          variant="ghost"
          onPress={handleDiscardTimer}
        />
        <Button
          title={t("home.timer.log")}
          onPress={() => openLoggerFromTimer(state)}
        />
      </View>
    ) : (
      <View style={styles.actionRow}>
        <View style={styles.timerRunning}>
          <View style={styles.timerDot} />
          <TimerClock timer={state} style={styles.timerClock} />
        </View>
        <Button
          title={t("home.timer.stop")}
          icon="stop"
          onPress={handleStopTimer}
        />
      </View>
    );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SPACING[5] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Eyebrow style={styles.date}>
              {formatDate(new Date(), {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Eyebrow>
            <SettingsButton raised />
          </View>
          <Text style={styles.greeting} accessibilityRole="header">
            {greeting}{" "}
            {prefs?.username ? (
              <Text style={styles.greetingName}>{prefs.username}.</Text>
            ) : null}
          </Text>
=======
  const topPart = () => (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("home.title")}</Text>
        {userPreferences && (
          <Text style={styles.subtitle}>
            {t("home.welcomeBack", { username: userPreferences.username })}
          </Text>
        )}
      </View>

      {goalIncreaseBanner && (
        <View style={styles.goalUpdateBanner}>
          <View style={styles.goalUpdateBannerContent}>
            <Text style={styles.goalUpdateBannerTitle}>
              {t("home.goalUpdateBanner.title")}
            </Text>
            <Text style={styles.goalUpdateBannerBody}>
              {t("home.goalUpdateBanner.body", {
                oldGoal: goalIncreaseBanner.oldGoal,
                newGoal: goalIncreaseBanner.newGoal,
              })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.goalUpdateBannerDismissButton}
            onPress={dismissGoalIncreaseBanner}
          >
            <Text style={styles.goalUpdateBannerDismissText}>
              {t("home.goalUpdateBanner.dismiss")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Continue Reading Hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroEyebrow}>{t("home.reading")}</Text>
>>>>>>> origin/xccBuild
        </View>

        <View style={styles.todayBlock}>
          <View style={styles.todayRow}>
            <View
              style={styles.minutes}
              accessible
              accessibilityLabel={`${todayMinutes} ${t("today.ofGoal", { goal: dailyGoal })}`}
            >
              <Text style={styles.numeral}>{todayMinutes}</Text>
              <Text style={styles.ofGoal}>
                {t("today.ofGoal", { goal: dailyGoal })}
              </Text>
            </View>
            {streak > 0 && (
              <View style={styles.streak} accessible>
                <Ionicons name="flame" size={16} color={COLORS.streak.fill} />
                <Text style={styles.streakText}>
                  {t("today.streak", { count: streak })}
                </Text>
              </View>
            )}
          </View>
          <ProgressRule progress={todayMinutes / dailyGoal} />
          <Text style={styles.statusLine}>{statusLine}</Text>
        </View>

        {week.length === 7 && (
          <WeekStrip days={week} onPress={() => router.push("/readinglogs")} />
        )}

        <View style={styles.section}>
          <Eyebrow>{t("today.currentlyReading")}</Eyebrow>
          {shownBook ? (
            <>
              <BookRow book={shownBook} onPress={() => openBook(shownBook.id)} />
              {reading.length > 1 && !timer && (
                <View style={styles.switcher}>
                  {reading.map((book) => {
                    const selected = book.id === shownBook.id;
                    return (
                      <Pressable
                        key={book.id}
                        onPress={() => setPickedBookId(book.id)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t("today.showBook", {
                          title: book.name,
                        })}
                        style={[
                          styles.switcherItem,
                          selected && styles.switcherItemSelected,
                        ]}
                      >
                        <BookCover
                          uri={book.cover_url}
                          title={book.name}
                          width={26}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              )}
<<<<<<< HEAD
              {timer ? (
                renderTimer(timer)
              ) : (
                <View style={styles.actionRow}>
                  <Button
                    title={t("today.logReading")}
                    onPress={() => openLogger({ bookId: shownBook.id })}
                    grow
                  />
                  <Button
                    title={t("today.timer")}
                    icon="play"
                    variant="secondary"
                    onPress={handleStartTimer}
                  />
                </View>
              )}
            </>
          ) : (
            <View style={styles.empty}>
              {timer && renderTimer(timer)}
              <Text style={styles.emptyText}>
                {books.length > 0
                  ? t("today.noBookInProgress")
                  : t("today.noBooksYet")}
=======

              <View style={styles.heroBookMeta}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {currentBook.name}
                </Text>
                <Text style={styles.heroAuthor} numberOfLines={1}>
                  {currentBook.author}
                </Text>
                <Text style={styles.heroPages}>
                  {currentBook.page} {t("components.bookCard.pages")}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.heroPrimaryButton}
              onPress={() => setShowReadingLogger(true)}
            >
              <Text style={styles.heroPrimaryButtonText}>
                {t("home.logReadingTime")}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.heroEmptyState}>
            <Text style={styles.heroEmptyTitle}>{t("home.noBooksYet")}</Text>
            <Link href={"/(books)" as any} asChild>
              <TouchableOpacity style={styles.heroPrimaryButton}>
                <Text style={styles.heroPrimaryButtonText}>
                  {t("home.discoverBooks")}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        )}
      </View>

      {/* Daily Reading Progress Card */}
      <DailyProgressCard
        todayMinutes={todayMinutes}
        goalMinutes={
          userPreferences?.current_reading_rate_minutes_per_day || 30
        }
      />

      <View style={styles.goalCriteriaContainer}>
        <GoalIncreaseCriteriaCard
          autoIncreaseEnabled={autoIncreaseEnabled}
          currentDailyGoal={currentDailyGoal}
          goalMetDays={goalMetDays}
          activeDays={activeDays}
          requiredGoalMetDays={requiredGoalMetDays}
          windowDays={windowDays}
          loading={criteriaLoading}
          isNewUser={!hasUserPreferences}
        />
      </View>

      <View style={styles.actionsRow}>
        <Link href={"/readinglogs"} asChild>
          <TouchableOpacity style={styles.secondaryActionButton}>
            <Text style={styles.secondaryActionButtonText}>
              {t("home.viewReadingLogs")}
            </Text>
          </TouchableOpacity>
        </Link>
        <Link href={"/(books)" as any} asChild>
          <TouchableOpacity style={styles.secondaryActionButton}>
            <Text style={styles.secondaryActionButtonText}>
              {t("home.seeAll")}
            </Text>
          </TouchableOpacity>
        </Link>
      </View>

      <View style={styles.progressSummaryCard}>
        <Text style={styles.cardTitle}>{t("home.readingJourney")}</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{booksRead}</Text>
              <Text style={styles.statLabel}>{t("home.booksRead")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{currentlyReading}</Text>
              <Text style={styles.statLabel}>{t("home.reading")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{wantToRead}</Text>
              <Text style={styles.statLabel}>{t("home.wantToRead")}</Text>
            </View>
          </View>

          {yearlyGoal > 0 && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {booksRead >= yearlyGoal
                  ? t("home.goalAchieved")
                  : t("home.goalProgress", {
                      remaining: yearlyGoal - booksRead,
                      goal: yearlyGoal,
                    })}
>>>>>>> origin/xccBuild
              </Text>
              <Button
                title={hasUpNext ? t("today.chooseBook") : t("today.addBook")}
                variant="secondary"
                onPress={() =>
                  hasUpNext
                    ? setChoosing(true)
                    : openAddBook({ status: "currently_reading", closeOnAdd: true })
                }
              />
            </View>
          )}
        </View>

        {todaySessions.length > 0 && (
          <View style={styles.section}>
            <Eyebrow>{t("today.todaysReading")}</Eyebrow>
            <View>
              {todaySessions.map((session, index) => (
                <View key={session.id}>
                  {index > 0 && <Hairline />}
                  <SessionRow
                    label={session.book_name}
                    detail={formatSessionDetail(session)}
                    onPress={() => editSession(session)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {yearlyGoal > 0 && (
          <View style={styles.yearly}>
            <View style={styles.yearlyRow}>
              <Text style={styles.yearlyText}>
                {finishedThisYear.length >= yearlyGoal
                  ? t("today.yearlyDone", { goal: yearlyGoal, year: currentYear })
                  : t("today.yearly", {
                      count: finishedThisYear.length,
                      goal: yearlyGoal,
                      year: currentYear,
                    })}
              </Text>
              <Text style={styles.yearlyPercent}>
                {t("today.percent", {
                  percent: Math.min(
                    100,
                    Math.round((finishedThisYear.length / yearlyGoal) * 100),
                  ),
                })}
              </Text>
            </View>
            {yearlyGoal <= MAX_SPINES ? (
              <View style={styles.spines} accessible={false}>
                {Array.from({ length: yearlyGoal }, (_, i) => {
                  const read = i < finishedThisYear.length;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.spine,
                        read
                          ? {
                              height: 18 + ((i * 7) % 9),
                              backgroundColor:
                                COLORS.cover.spines[i % COLORS.cover.spines.length],
                            }
                          : styles.spineEmpty,
                      ]}
                    />
                  );
                })}
              </View>
            ) : (
              <ProgressRule
                progress={finishedThisYear.length / yearlyGoal}
                color={COLORS.ink.primary}
              />
            )}
          </View>
        )}

        <OptionSheet
          visible={choosing}
          title={t("today.chooseBook")}
          options={upNext.map((book) => ({
            key: String(book.id),
            label: book.author ? `${book.name} · ${book.author}` : book.name,
          }))}
          selected=""
          onSelect={(key) => {
            const book = upNext.find((b) => String(b.id) === key);
            if (book) setBookStatus(book, "currently_reading", { fromSheet: true });
          }}
          onClose={() => setChoosing(false)}
        />
      </ScrollView>
      <StatusBarBand />
    </View>
  );
}

function BookRow({
  book,
  onPress,
}: {
  book: BookWithStats;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const progress = computeBookProgress(book);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${book.name}, ${book.author}`}
      style={({ pressed }) => [styles.bookRow, pressed && styles.pressed]}
    >
      <BookCover
        uri={book.cover_url}
        title={book.name}
        author={book.author}
        width={84}
      />
      <View style={styles.bookMeta}>
        <Text style={styles.bookTitle} numberOfLines={3}>
          {book.name}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          {book.author}
        </Text>
        <Text style={styles.bookPages}>
          {book.page > 0
            ? t("today.pageOf", {
                current: progress.pagesRead,
                total: book.page,
                percent: progress.percentage,
              })
            : t("today.pagesUnknown")}
        </Text>
        {book.page > 0 && (
          <ProgressRule
            progress={progress.percentage / 100}
            color={COLORS.ink.primary}
            thickness={2}
            style={styles.bookProgress}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.paper.base,
  },
  content: {
    paddingHorizontal: SPACING[5],
    paddingBottom: SPACING[8],
    gap: SPACING[5] + 4,
  },
  pressed: {
    opacity: 0.6,
  },
  header: {
<<<<<<< HEAD
=======
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[5],
    paddingBottom: SPACING[3],
    alignItems: "flex-start",
  },
  title: {
    ...TYPE.pageTitle,
  },
  subtitle: {
    ...TYPE.body,
    marginTop: 2,
  },
  goalUpdateBanner: {
    marginHorizontal: SPACING[4],
    marginBottom: SPACING[3],
    backgroundColor: COLORS.state.primarySoftAlt,
    borderWidth: 1,
    borderColor: COLORS.state.successBorder,
    borderRadius: 12,
    padding: SPACING[3],
    gap: SPACING[2],
  },
  goalUpdateBannerContent: {
    gap: 4,
  },
  goalUpdateBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.accent.strong,
  },
  goalUpdateBannerBody: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  goalUpdateBannerDismissButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface.raised,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  goalUpdateBannerDismissText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.accent.strong,
  },
  heroCard: {
    backgroundColor: COLORS.surface.raised,
    marginHorizontal: SPACING[4],
    marginBottom: SPACING[3],
    padding: SPACING[4],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING[3],
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: COLORS.text.secondary,
  },
  heroBookRow: {
    flexDirection: "row",
    gap: SPACING[3],
    marginBottom: SPACING[3],
  },
  heroCover: {
    width: 62,
    height: 92,
    borderRadius: 8,
    backgroundColor: COLORS.neutral[100],
  },
  heroCoverPlaceholder: {
    width: 62,
    height: 92,
    borderRadius: 8,
    backgroundColor: COLORS.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  heroCoverPlaceholderText: {
    fontSize: 24,
  },
  heroBookMeta: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  heroAuthor: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  heroPages: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  heroPrimaryButton: {
    backgroundColor: COLORS.accent.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  heroPrimaryButtonText: {
    color: COLORS.text.inverse,
    fontSize: 15,
    fontWeight: "600",
  },
  heroEmptyState: {
    gap: SPACING[3],
  },
  heroEmptyTitle: {
    ...TYPE.body,
    color: COLORS.text.secondary,
  },
  progressSummaryCard: {
    backgroundColor: COLORS.surface.raised,
    marginHorizontal: SPACING[4],
    marginTop: SPACING[2],
    padding: SPACING[4],
    borderRadius: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  goalCriteriaContainer: {
    marginHorizontal: SPACING[4],
    marginTop: SPACING[3],
  },
  cardTitle: {
    ...TYPE.cardTitle,
    marginBottom: SPACING[3],
  },
  progressContainer: {
    gap: SPACING[3],
  },
  progressStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.neutral[200],
  },
  progressBarContainer: {
    gap: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: COLORS.neutral[200],
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "left",
    fontWeight: "500",
  },
  listSection: {
    flex: 1,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.neutral[800],
  },
  seeAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.neutral[100],
    borderRadius: 8,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.accent.strong,
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.neutral[500],
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.neutral[400],
    textAlign: "center",
    marginBottom: 20,
  },
  addFirstBookBtn: {
    backgroundColor: COLORS.accent.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFirstBookText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
  },
  actionsRow: {
    paddingHorizontal: SPACING[4],
    marginBottom: SPACING[3],
    flexDirection: "row",
>>>>>>> origin/xccBuild
    gap: SPACING[2],
  },
  // The gear's 40pt box overlaps the space above and below the eyebrow
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: -SPACING[2],
  },
  date: {
    flexShrink: 1,
  },
  greeting: TYPE.display,
  greetingName: {
    fontFamily: FONTS.serifItalic,
  },
  todayBlock: {
    gap: SPACING[3],
  },
  todayRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: SPACING[3],
  },
  minutes: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: SPACING[2],
    flexShrink: 1,
  },
  numeral: TYPE.numeral,
  ofGoal: {
    ...TYPE.byline,
    fontSize: 20,
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: SPACING[2],
  },
  streakText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: COLORS.accent.primary,
  },
  statusLine: {
    ...TYPE.body,
    fontSize: 14,
  },
  section: {
    gap: SPACING[4],
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING[4] + 2,
  },
  bookMeta: {
    flex: 1,
    gap: 3,
    paddingTop: 2,
  },
  bookTitle: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    lineHeight: 29,
    color: COLORS.ink.primary,
  },
  bookAuthor: TYPE.byline,
  bookPages: {
    ...TYPE.meta,
    marginTop: SPACING[3],
    fontVariant: ["tabular-nums"],
  },
  bookProgress: {
    marginTop: SPACING[1],
    maxWidth: 200,
  },
  switcher: {
    flexDirection: "row",
    gap: SPACING[3],
  },
  switcherItem: {
    paddingBottom: SPACING[2],
    borderBottomWidth: 2,
    borderBottomColor: COLORS.transparent,
  },
  switcherItemSelected: {
    borderBottomColor: COLORS.ink.primary,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
  },
  timerRunning: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.destructive.ink,
  },
  timerClock: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    color: COLORS.ink.primary,
    fontVariant: ["tabular-nums"],
  },
  timerReady: {
    ...TYPE.bodyStrong,
    flex: 1,
  },
  empty: {
    gap: SPACING[4],
    alignItems: "flex-start",
  },
  emptyText: {
    ...TYPE.byline,
    fontSize: 19,
  },
  yearly: {
    gap: SPACING[3],
    paddingTop: SPACING[4],
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
  },
  yearlyRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: SPACING[3],
  },
  yearlyText: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    lineHeight: 25,
    color: COLORS.ink.primary,
    flex: 1,
  },
  yearlyPercent: TYPE.meta,
  spines: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 26,
  },
  spine: {
    flex: 1,
    borderRadius: 1,
  },
  spineEmpty: {
    height: 14,
    backgroundColor: COLORS.line.hairline,
  },
});
