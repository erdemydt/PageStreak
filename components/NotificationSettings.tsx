import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AppState,
  Linking,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { NotificationPreferences } from '../db/db';
import NotificationService from '../services/notificationService';

export default function NotificationSettings() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSystemPermission, setHasSystemPermission] = useState(false);

  useEffect(() => {
    loadPreferences();
    checkSystemPermissions();
    
    // Listen for app state changes to detect when user returns from settings
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Add a small delay to ensure system settings have been processed
        setTimeout(() => {
          checkSystemPermissions();
        }, 500);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  const checkSystemPermissions = useCallback(async () => {
    try {
      const hasPermission = await NotificationService.checkCurrentPermissions();
      setHasSystemPermission(hasPermission);
      
      // If system permissions changed, sync with database
      if (preferences && hasPermission !== preferences.notifications_enabled) {
        console.log('🔄 System permissions changed, syncing with database');
        await NotificationService.syncPermissionsWithDatabase();
        await loadPreferences(); // Reload preferences to reflect changes
      }
    } catch (error) {
      console.error('❌ Error checking system permissions:', error);
    }
  }, [preferences]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await NotificationService.getNotificationPreferences();
      console.log('🔔 Raw preferences from database:', prefs);

      if (prefs) {
        // Ensure boolean values are properly converted from SQLite integers
        const normalizedPrefs = {
          ...prefs,
          notifications_enabled: Boolean(prefs.notifications_enabled),
          daily_reminder_enabled: Boolean(prefs.daily_reminder_enabled)
        };
        console.log('🔔 Normalized preferences:', normalizedPrefs);
        setPreferences(normalizedPrefs);
      } else {
        console.log('⚠️ No preferences returned from service');
        setPreferences(null);
      }
    } catch (error) {
      console.error('❌ Error loading notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!preferences) return;

    console.log('🔄 Updating preferences:', JSON.stringify(updates, null, 2));
    console.log('🔄 Current preferences before update:', JSON.stringify(preferences, null, 2));

    try {
      setSaving(true);
      const success = await NotificationService.updateNotificationPreferences(updates);
      console.log('✅ Update success:', success);

      if (success) {
        const updatedPrefs = { ...preferences, ...updates };
        console.log('📱 Setting new preferences state:', JSON.stringify(updatedPrefs, null, 2));
        setPreferences(updatedPrefs);
      } else {
        console.warn('⚠️ Update was not successful');
      }
    } catch (error) {
      console.error('❌ Error updating notification preferences:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    console.log('🔔 Main notification toggle changed to:', enabled);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (enabled) {
      // Check current system permissions first
      const currentSystemPermission = await NotificationService.checkCurrentPermissions();
      
      if (!currentSystemPermission) {
        // Try to request permission
        console.log('🔐 Requesting notification permissions...');
        const hasPermission = await NotificationService.requestPermissions();
        console.log('🔐 Permission granted:', hasPermission);

        if (!hasPermission) {
          console.warn('⚠️ Permission denied, showing settings alert');
          Alert.alert(
            t('settings.permissionRequired'),
            t('settings.notificationPermissionDenied'),
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                style: 'default',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
          return;
        }
        
        // Update system permission state
        setHasSystemPermission(true);
      }
    }

    console.log('📱 Updating main notification preference to:', enabled);
    await updatePreferences({ notifications_enabled: enabled });
  };

  const handleTestNotification = async () => {
    try {
      // Check current system permissions first
      const currentSystemPermission = await NotificationService.checkCurrentPermissions();
      
      if (!currentSystemPermission) {
        const hasPermission = await NotificationService.requestPermissions();
        if (!hasPermission) {
          Alert.alert(
            t('settings.permissionRequired'),
            t('settings.notificationPermissionDenied'),
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                style: 'default',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
          return;
        }
      }

      // Check if in development mode for different behavior
      if (__DEV__) {
        // In development, schedule a 1-minute test
        await NotificationService.scheduleTestNotification(1);
        Alert.alert(t('settings.devTestScheduled'), t('settings.devTestScheduledMessage'));
      } else {
        // In production, use the normal scheduling
        await NotificationService.scheduleDailyReminderNotification();
        Alert.alert(t('settings.testScheduled'), t('settings.testScheduledMessage', { hours: preferences?.daily_reminder_hours_after_last_open || 5 }));
      }
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  if (loading || !preferences) {
    console.log('🔄 Loading notification settings or preferences not available');
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Ionicons name="notifications" size={32} color="#6C63FF" />
          <Text style={styles.loadingText}>{t('settings.loadingNotificationSettings')}</Text>
        </View>
      </View>
    );
  }

  console.log('🎨 Rendering NotificationSettings with preferences:', {
    notifications_enabled: preferences.notifications_enabled,
    daily_reminder_enabled: preferences.daily_reminder_enabled,
    daily_reminder_hours_after_last_open: preferences.daily_reminder_hours_after_last_open,
    hasSystemPermission
  });

  // Show system permission warning if needed
  const showPermissionWarning = preferences.notifications_enabled && !hasSystemPermission;

  return (
    <View style={styles.container}>
      {/* System Permission Warning */}
      {showPermissionWarning && (
        <View style={styles.warningContainer}>
          <View style={styles.warningContent}>
            <Ionicons name="warning" size={20} color="#F59E0B" />
            <Text style={styles.warningText}>
              Notifications are disabled in system settings. 
            </Text>
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }}
            >
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Notifications Toggle */}
      <View style={styles.mainToggleContainer}>
        <View style={styles.toggleHeader}>
          <View style={[styles.iconContainer, showPermissionWarning && styles.iconContainerWarning]}>
            <Ionicons 
              name={showPermissionWarning ? "notifications-off" : "notifications"} 
              size={24} 
              color={showPermissionWarning ? "#F59E0B" : "#6C63FF"} 
            />
          </View>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>{t('settings.pushNotifications')}</Text>
            <Text style={styles.toggleSubtitle}>
              {t('settings.pushNotificationsDescription')}
            </Text>
          </View>
          <Switch
            value={preferences.notifications_enabled && hasSystemPermission}
            onValueChange={handleNotificationToggle}
            trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
            thumbColor={(preferences.notifications_enabled && hasSystemPermission) ? '#6C63FF' : '#9CA3AF'}
            disabled={saving}
            style={styles.toggle}
          />
        </View>
      </View>

      {/* Daily Reminders Section - Only show when notifications are enabled */}
      {preferences.notifications_enabled && hasSystemPermission && (
        <View style={styles.dailyRemindersContainer}>
          <View style={styles.subToggleContainer}>
            <View style={styles.subToggleHeader}>
              <View style={styles.subIconContainer}>
                <Ionicons name="alarm" size={20} color="#10B981" />
              </View>
              <View style={styles.subToggleInfo}>
                <Text style={styles.subToggleTitle}>{t('settings.dailyReadingReminders')}</Text>
                <Text style={styles.subToggleSubtitle}>
                  {t('settings.dailyReadingRemindersDescription')}
                </Text>
              </View>
              <Switch
                value={preferences.daily_reminder_enabled}
                onValueChange={(enabled) => {
                  console.log('⏰ Daily reminder toggle changed to:', enabled);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updatePreferences({ daily_reminder_enabled: enabled });
                }}
                trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
                thumbColor={preferences.daily_reminder_enabled ? '#10B981' : '#9CA3AF'}
                disabled={saving}
                style={styles.subToggle}
              />
            </View>
          </View>

          {/* Hours Setting - Only show when daily reminders are enabled */}
          {preferences.daily_reminder_enabled && (
            <View style={styles.settingsContainer}>
              <View style={styles.hourSettingContainer}>
                <View style={styles.hourSettingHeader}>
                  <Ionicons name="time-outline" size={20} color="#F59E0B" />
                  <Text style={styles.hourSettingTitle}>{t('settings.reminderTiming')}</Text>
                </View>

                <Text style={styles.hourSectionTitle}>{t('settings.hourSelectionDescription')}:</Text>

                <View style={styles.hourSectionContainer}>


                  <View style={styles.hourGridContainer}>
                    {[1, 3, 5, 8, 12, 24].map((hours) => (
                      <TouchableOpacity
                        key={hours}
                        style={[
                          styles.hourOptionCard,
                          preferences.daily_reminder_hours_after_last_open === hours && styles.hourOptionCardSelected
                        ]}
                        onPress={() => {
                          console.log('⏱️ Hour option changed to:', hours);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          updatePreferences({ daily_reminder_hours_after_last_open: hours });
                        }}
                        disabled={saving}
                        activeOpacity={0.7}
                      >
                        <View style={styles.hourOptionContent}>
                          <Text style={[
                            styles.hourOptionNumber,
                            preferences.daily_reminder_hours_after_last_open === hours && styles.hourOptionNumberSelected
                          ]}>
                            {hours}
                          </Text>
                          <Text style={[
                            styles.hourOptionLabel,
                            preferences.daily_reminder_hours_after_last_open === hours && styles.hourOptionLabelSelected
                          ]}>
                            {hours === 1 ? t('settings.hourSingular') : t('settings.hourPlural')}
                          </Text>
                        </View>
                        {preferences.daily_reminder_hours_after_last_open === hours && (
                          <View style={styles.selectedIndicator}>
                            <Ionicons name="checkmark-circle" size={16} color="#6C63FF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <Text style={styles.hourSettingDescription}>
                  {t('settings.reminderTimingDescription', { hours: preferences.daily_reminder_hours_after_last_open })}
                </Text>
              </View>

              {/* Test Notification Button */}
              <TouchableOpacity
                style={styles.testButton}
                onPress={handleTestNotification}
                disabled={saving}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
                <Text style={styles.testButtonText}>
                  {__DEV__ ? t('settings.sendTestDev') : t('settings.sendTest')}
                </Text>
                {__DEV__ && <Text style={styles.devBadge}>DEV</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  loadingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
  mainToggleContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  toggle: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  dailyRemindersContainer: {
    backgroundColor: '#F8FAFC',
  },
  subToggleContainer: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subToggleInfo: {
    flex: 1,
  },
  subToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  subToggleSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  subToggle: {
    transform: [{ scaleX: 1.0 }, { scaleY: 1.0 }],
  },
  settingsContainer: {
    padding: 20,
    paddingTop: 16,
  },
  hourSettingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hourSettingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  hourSettingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 8,
  },
  hourSettingDescription: {
    fontSize: 14,
    marginTop: 12,
    color: '#a7afbcff',
    lineHeight: 20,
  },
  hourInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hourInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  hourInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourOptionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  hourOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    minWidth: 60,
    alignItems: 'center',
  },
  hourOptionSelected: {
    borderColor: '#6C63FF',
    backgroundColor: '#EEF2FF',
  },
  hourOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  hourOptionTextSelected: {
    color: '#6C63FF',
  },
  // New improved hour selector styles
  hourSectionContainer: {
    marginTop: 16,
  },
  hourSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  hourSectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  hourGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  hourOptionCard: {
    width: '30%',
    minWidth: 70,
    maxWidth: 90,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 10,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  hourOptionCardSelected: {
    borderColor: '#6C63FF',
    backgroundColor: '#F8FAFF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  hourOptionContent: {
    alignItems: 'center',
    width: '100%',
  },
  hourOptionNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 1,
  },
  hourOptionNumberSelected: {
    color: '#6C63FF',
  },
  hourOptionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  hourOptionLabelSelected: {
    color: '#6C63FF',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    marginRight: 8,
  },
  devBadge: {
    backgroundColor: '#FF6B6B',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  // Warning styles
  warningContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    marginRight: 8,
  },
  settingsButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  iconContainerWarning: {
    backgroundColor: '#FEF3C7',
  },
});
