import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import NotificationService from "../services/notificationService";
import { COLORS } from "../themes/colors";
import { isDevModeEnabled } from "../utils/devMode";

const NotificationTester: React.FC = () => {
  const { t } = useTranslation();
  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  const [isDev, setIsDev] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkIfDevelopment();
    loadNotificationStatus();
  }, []);

  const checkIfDevelopment = () => {
    setIsDev(isDevModeEnabled());
  };

  const loadNotificationStatus = async () => {
    setLoading(true);
    try {
      const status = await NotificationService.getNotificationStatus();
      setNotificationStatus(status);
    } catch (error) {
      console.error("Error loading notification status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendImmediateTest = async () => {
    try {
      await NotificationService.sendImmediateTestNotification();
      Alert.alert(
        t("components.notificationTester.immediateTestSent"),
        t("components.notificationTester.checkNotificationPanel"),
      );
    } catch (error) {
      Alert.alert(
        t("components.notificationTester.error"),
        t("components.notificationTester.failedToSendImmediateTest"),
      );
    }
  };

  const handleSchedule1MinuteTest = async () => {
    try {
      await NotificationService.scheduleTestNotification(1);
      Alert.alert(
        t("components.notificationTester.testScheduled"),
        t("components.notificationTester.notificationIn1Minute"),
      );
      await loadNotificationStatus();
    } catch (error) {
      Alert.alert(
        t("components.notificationTester.error"),
        t("components.notificationTester.failedToScheduleTest"),
      );
    }
  };

  const handleSchedule5MinuteTest = async () => {
    try {
      await NotificationService.scheduleTestNotification(5);
      Alert.alert(
        t("components.notificationTester.testScheduled"),
        t("components.notificationTester.notificationIn5Minutes"),
      );
      await loadNotificationStatus();
    } catch (error) {
      Alert.alert(
        t("components.notificationTester.error"),
        t("components.notificationTester.failedToScheduleTest"),
      );
    }
  };

  const handleCheckSchedule = async () => {
    try {
      await NotificationService.checkAndScheduleNotification();
      Alert.alert(
        t("components.notificationTester.scheduleCheck"),
        t("components.notificationTester.checkedAndScheduled"),
      );
      await loadNotificationStatus();
    } catch (error) {
      Alert.alert(
        t("components.notificationTester.error"),
        t("components.notificationTester.failedToCheckSchedule"),
      );
    }
  };

  const handleCancelNotifications = async () => {
    try {
      await NotificationService.cancelScheduledNotification();
      Alert.alert(
        t("components.notificationTester.cancelled"),
        t("components.notificationTester.allNotificationsCancelled"),
      );
      await loadNotificationStatus();
    } catch (error) {
      Alert.alert(
        t("components.notificationTester.error"),
        t("components.notificationTester.failedToCancelNotifications"),
      );
    }
  };

  if (!isDev) {
    return null; // Don't show in production
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="flask" size={24} color={COLORS.state.dangerStrong} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {t("components.notificationTester.title")}
          </Text>
          <Text style={styles.subtitle}>
            {t("components.notificationTester.subtitle")}
          </Text>
        </View>
        <View style={styles.devBadge}>
          <Text style={styles.devBadgeText}>
            {t("components.notificationTester.devBadge")}
          </Text>
        </View>
      </View>

      {notificationStatus && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>
            {t("components.notificationTester.currentStatus")}
          </Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>
                {t("components.notificationTester.enabled")}
              </Text>
              <Text style={styles.statusValue}>
                {notificationStatus.enabled ? "✅" : "❌"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>
                {t("components.notificationTester.permission")}
              </Text>
              <Text style={styles.statusValue}>
                {notificationStatus.hasPermission ? "✅" : "❌"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>
                {t("components.notificationTester.scheduled")}
              </Text>
              <Text style={styles.statusValue}>
                {notificationStatus.scheduledNotifications}
              </Text>
            </View>
            <View style={styles.statusItemWide}>
              <Text style={styles.statusLabel}>
                {t("components.notificationTester.lastOpened")}
              </Text>
              <Text style={styles.statusValue}>
                {notificationStatus.lastOpenedTime
                  ? new Date(notificationStatus.lastOpenedTime).toLocaleString()
                  : t("components.notificationTester.never")}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle}>
          {t("components.notificationTester.testActions")}
        </Text>

        <View style={styles.buttonGrid}>
          <TouchableOpacity
            style={[styles.button, styles.immediateButton]}
            onPress={handleSendImmediateTest}
          >
            <Ionicons name="flash" size={18} color={COLORS.white} />
            <Text style={styles.buttonText}>
              {t("components.notificationTester.immediateTest")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.timedButton]}
            onPress={handleSchedule1MinuteTest}
          >
            <Ionicons name="time" size={18} color={COLORS.white} />
            <Text style={styles.buttonText}>
              {t("components.notificationTester.oneMinuteTest")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.timedButton]}
            onPress={handleSchedule5MinuteTest}
          >
            <Ionicons name="timer" size={18} color={COLORS.white} />
            <Text style={styles.buttonText}>
              {t("components.notificationTester.fiveMinuteTest")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.usageButton]}
            onPress={handleCheckSchedule}
          >
            <Ionicons name="analytics" size={18} color={COLORS.white} />
            <Text style={styles.buttonText}>
              {t("components.notificationTester.usageTest")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancelNotifications}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.white} />
            <Text style={styles.buttonText}>
              {t("components.notificationTester.cancelAll")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.refreshButton]}
            onPress={loadNotificationStatus}
          >
            <Ionicons name="refresh" size={18} color={COLORS.white} />
            <Text style={styles.buttonText}>
              {t("components.notificationTester.refreshStatus")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.state.dangerStrong,
    shadowColor: COLORS.state.dangerStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: COLORS.state.dangerSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.state.dangerBorder,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.state.dangerSoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.state.dangerText,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.state.dangerText,
  },
  devBadge: {
    backgroundColor: COLORS.state.dangerStrong,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  devBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  statusContainer: {
    padding: 20,
    backgroundColor: COLORS.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[700],
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statusItem: {
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 8,
    minWidth: "30%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  statusItemWide: {
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.neutral[500],
    fontWeight: "500",
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 14,
    color: COLORS.neutral[800],
    fontWeight: "600",
    textAlign: "center",
  },
  actionsContainer: {
    padding: 20,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[700],
    marginBottom: 16,
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    minWidth: "45%",
    flex: 1,
  },
  immediateButton: {
    backgroundColor: COLORS.danger,
  },
  timedButton: {
    backgroundColor: COLORS.info,
  },
  usageButton: {
    backgroundColor: COLORS.state.readingHeat4,
    minWidth: "100%",
  },
  controlButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    backgroundColor: COLORS.neutral[500],
  },
  refreshButton: {
    backgroundColor: COLORS.success,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
});

export default NotificationTester;
