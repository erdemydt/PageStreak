import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import EditSessionModal from "../../../components/reading/EditSessionModal";
import WeeklyStatsView from "../../../components/reading/WeeklyStatsView";
import { useReadingSessions } from "../../../hooks/useReadingSessions";
import { COLORS } from "../../../themes/colors";
export default function ReadingLogs() {
  const { t } = useTranslation();
  const {
    weekData,
    loading,
    refreshing,
    editModalVisible,
    selectedSession,
    isWeeklyView,
    weekStart,
    weekEnd,
    weekTotal,
    setIsWeeklyView,
    loadWeekData,
    navigateWeek,
    goToCurrentWeek,
    onRefresh,
    handleEditSession,
    closeEditModal,
    handleUpdateSession,
    handleDeleteSession,
    formatDate,
  } = useReadingSessions();

  useFocusEffect(
    useCallback(() => {
      loadWeekData();
    }, [loadWeekData]),
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>
          {t("components.readingLogs.loadingText")}
        </Text>
      </View>
    );
  }

  if (isWeeklyView) {
    return (
      <View style={styles.container}>
        {/* View Mode Toggle */}
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              !isWeeklyView ? styles.toggleButtonActive : undefined,
            ]}
            onPress={() => setIsWeeklyView(false)}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={!isWeeklyView ? COLORS.white : COLORS.neutral[500]}
            />
            <Text
              style={[
                styles.toggleText,
                !isWeeklyView ? styles.toggleTextActive : undefined,
              ]}
            >
              {t("components.readingLogs.dailyView")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              isWeeklyView ? styles.toggleButtonActive : undefined,
            ]}
            onPress={() => setIsWeeklyView(true)}
          >
            <Ionicons
              name="analytics"
              size={16}
              color={isWeeklyView ? COLORS.white : COLORS.neutral[500]}
            />
            <Text
              style={[
                styles.toggleText,
                isWeeklyView ? styles.toggleTextActive : undefined,
              ]}
            >
              {t("components.readingLogs.analytics")}
            </Text>
          </TouchableOpacity>
        </View>

        <WeeklyStatsView
          weekStart={weekStart}
          onNavigateWeek={navigateWeek}
          onGoToCurrentWeek={goToCurrentWeek}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* View Mode Toggle */}
      <View style={styles.viewModeToggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            !isWeeklyView ? styles.toggleButtonActive : undefined,
          ]}
          onPress={() => setIsWeeklyView(false)}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={!isWeeklyView ? COLORS.white : COLORS.neutral[500]}
          />
          <Text
            style={[
              styles.toggleText,
              !isWeeklyView ? styles.toggleTextActive : undefined,
            ]}
          >
            {t("components.readingLogs.dailyView")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isWeeklyView ? styles.toggleButtonActive : undefined,
          ]}
          onPress={() => setIsWeeklyView(true)}
        >
          <Ionicons
            name="analytics"
            size={16}
            color={isWeeklyView ? COLORS.white : COLORS.neutral[500]}
          />
          <Text
            style={[
              styles.toggleText,
              isWeeklyView ? styles.toggleTextActive : undefined,
            ]}
          >
            {t("components.readingLogs.analytics")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity
            onPress={() => navigateWeek("prev")}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goToCurrentWeek} style={styles.weekInfo}>
            <Text style={styles.weekRange}>
              {formatDate(weekStart)} - {formatDate(weekEnd)}
            </Text>
            <Text style={styles.weekTotal}>
              {weekTotal} {t("components.readingLogs.minutesThisWeek")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigateWeek("next")}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Week Grid */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.weekGrid}>
          {weekData.map((day) => (
            <View
              key={day.date}
              style={[styles.dayCard, day.isToday && styles.todayCard]}
            >
              {/* Day Header */}
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName, day.isToday && styles.todayText]}>
                  {day.day}
                </Text>
                <Text
                  style={[styles.dayNumber, day.isToday && styles.todayText]}
                >
                  {day.dayNum}
                </Text>
                <Text
                  style={[styles.dayTotal, day.isToday && styles.todayText]}
                >
                  {day.totalMinutes}{" "}
                  {t("components.readingTimeLogger.minutesShort")}
                </Text>
              </View>

              {/* Sessions */}
              <View style={styles.sessionsContainer}>
                {day.sessions.length === 0 ? (
                  <Text style={styles.noSessionsText}>
                    {t("components.readingLogs.noSessionsText")}
                  </Text>
                ) : (
                  day.sessions.map((session) => (
                    <TouchableOpacity
                      key={session.id}
                      style={styles.sessionCard}
                      onPress={() => handleEditSession(session)}
                    >
                      <View style={styles.sessionHeader}>
                        <Text style={styles.sessionTime}>
                          {session.minutes_read}
                          {t("components.readingLogs.minutesSuffix")}
                        </Text>
                        <Text style={styles.editHint}>✏️</Text>
                      </View>
                      <Text style={styles.sessionBook} numberOfLines={2}>
                        {session.book_name}
                      </Text>
                      <Text style={styles.sessionAuthor} numberOfLines={1}>
                        {t("components.readingLogs.sessionCardBy")}{" "}
                        {session.book_author}
                      </Text>
                      {session.notes && (
                        <Text style={styles.sessionNotes} numberOfLines={2}>
                          &quot;{session.notes}&quot;
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <EditSessionModal
        visible={editModalVisible}
        session={selectedSession}
        onClose={closeEditModal}
        onSave={handleUpdateSession}
        onDelete={handleDeleteSession}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.neutral[500],
    fontWeight: "500",
  },
  viewModeToggle: {
    flexDirection: "row",
    backgroundColor: COLORS.neutral[100],
    borderRadius: 8,
    padding: 4,
    margin: 16,
    marginBottom: 0,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[500],
  },
  toggleTextActive: {
    color: COLORS.white,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
  },
  weekNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonText: {
    fontSize: 18,
    color: COLORS.neutral[700],
    fontWeight: "600",
  },
  weekInfo: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 16,
  },
  weekRange: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 4,
  },
  weekTotal: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  weekGrid: {
    paddingVertical: 20,
    gap: 16,
  },
  dayCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  todayCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.state.cardAccent,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[100],
  },
  dayName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[500],
    flex: 1,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.neutral[800],
    flex: 1,
    textAlign: "center",
  },
  dayTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    flex: 1,
    textAlign: "right",
  },
  todayText: {
    color: COLORS.primary,
  },
  sessionsContainer: {
    gap: 8,
  },
  noSessionsText: {
    fontSize: 14,
    color: COLORS.neutral[400],
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
  sessionCard: {
    backgroundColor: COLORS.neutral[50],
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sessionTime: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  editHint: {
    fontSize: 12,
    opacity: 0.6,
  },
  sessionBook: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.neutral[800],
    marginBottom: 2,
  },
  sessionAuthor: {
    fontSize: 12,
    color: COLORS.neutral[500],
    marginBottom: 4,
  },
  sessionNotes: {
    fontSize: 12,
    color: COLORS.neutral[700],
    fontStyle: "italic",
    backgroundColor: COLORS.neutral[100],
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
});
