import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NotificationService from '../services/notificationService';

const NotificationTester: React.FC = () => {
  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  const [isDev, setIsDev] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkIfDevelopment();
    loadNotificationStatus();
  }, []);

  const checkIfDevelopment = () => {
    setIsDev(__DEV__);
  };

  const loadNotificationStatus = async () => {
    setLoading(true);
    try {
      const status = await NotificationService.getNotificationStatus();
      setNotificationStatus(status);
    } catch (error) {
      console.error('Error loading notification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendImmediateTest = async () => {
    try {
      await NotificationService.sendImmediateTestNotification();
      Alert.alert('✅ Immediate Test Sent', 'Check your notification panel!');
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to send immediate test');
    }
  };

  const handleSchedule1MinuteTest = async () => {
    try {
      await NotificationService.scheduleTestNotification(1);
      Alert.alert('🕐 Test Scheduled', 'Notification will appear in 1 minute!');
      await loadNotificationStatus();
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to schedule test');
    }
  };

  const handleSchedule5MinuteTest = async () => {
    try {
      await NotificationService.scheduleTestNotification(5);
      Alert.alert('🕐 Test Scheduled', 'Notification will appear in 5 minutes!');
      await loadNotificationStatus();
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to schedule test');
    }
  };

  const handleCheckSchedule = async () => {
    try {
      await NotificationService.checkAndScheduleNotification();
      Alert.alert('✅ Schedule Check', 'Checked and scheduled based on app usage!');
      await loadNotificationStatus();
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to check schedule');
    }
  };

  const handleCancelNotifications = async () => {
    try {
      await NotificationService.cancelScheduledNotification();
      Alert.alert('🚫 Cancelled', 'All scheduled notifications cancelled!');
      await loadNotificationStatus();
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to cancel notifications');
    }
  };

  if (!isDev) {
    return null; // Don't show in production
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="flask" size={24} color="#FF6B6B" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Notification Tester</Text>
          <Text style={styles.subtitle}>Development testing tools</Text>
        </View>
        <View style={styles.devBadge}>
          <Text style={styles.devBadgeText}>DEV</Text>
        </View>
      </View>
      
      {notificationStatus && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>Current Status</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Enabled</Text>
              <Text style={styles.statusValue}>
                {notificationStatus.enabled ? '✅' : '❌'}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Permission</Text>
              <Text style={styles.statusValue}>
                {notificationStatus.hasPermission ? '✅' : '❌'}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Scheduled</Text>
              <Text style={styles.statusValue}>
                {notificationStatus.scheduledNotifications}
              </Text>
            </View>
            <View style={styles.statusItemWide}>
              <Text style={styles.statusLabel}>Last Opened</Text>
              <Text style={styles.statusValue}>
                {notificationStatus.lastOpenedTime 
                  ? new Date(notificationStatus.lastOpenedTime).toLocaleString()
                  : 'Never'
                }
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle}>Test Actions</Text>
        
        <View style={styles.buttonGrid}>
          <TouchableOpacity style={[styles.button, styles.immediateButton]} onPress={handleSendImmediateTest}>
            <Ionicons name="flash" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Immediate Test</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.timedButton]} onPress={handleSchedule1MinuteTest}>
            <Ionicons name="time" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>1 Min Test</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.timedButton]} onPress={handleSchedule5MinuteTest}>
            <Ionicons name="timer" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>5 Min Test</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.usageButton]} onPress={handleCheckSchedule}>
            <Ionicons name="analytics" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Usage Test</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.controlButtons}>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancelNotifications}>
            <Ionicons name="close-circle" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Cancel All</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.refreshButton]} onPress={loadNotificationStatus}>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Refresh Status</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#DC2626',
  },
  devBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  devBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusContainer: {
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    minWidth: '30%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusItemWide: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    textAlign: 'center',
  },
  actionsContainer: {
    padding: 20,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    minWidth: '45%',
    flex: 1,
  },
  immediateButton: {
    backgroundColor: '#EF4444',
  },
  timedButton: {
    backgroundColor: '#3B82F6',
  },
  usageButton: {
    backgroundColor: '#8B5CF6',
    minWidth: '100%',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  refreshButton: {
    backgroundColor: '#10B981',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default NotificationTester;
