import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Keyboard,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import LanguageSelector from '../../components/LanguageSelector';
import NotificationSettings from '../../components/NotificationSettings';
import NotificationTester from '../../components/NotificationTester';
import { queryFirst } from '../../db/db';
import { logoutUser } from '../../utils/migration';

type UserPreferences = {
  id: number;
  username: string;
  yearly_book_goal: number;
  preferred_genres?: string;
  created_at?: string;
  updated_at?: string;
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserPreferences();
  }, []);

  const loadUserPreferences = async () => {
    try {
      const user = await queryFirst<UserPreferences>('SELECT * FROM user_preferences WHERE id = 1');
      if (user) {
        setUserPreferences(user);
      }
    } catch (e) {
      console.error('Failed to load user preferences:', e);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logout'),
      'Are you sure you want to log out? This will delete all your books and reading progress. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: t('settings.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await logoutUser();
              
              // Direct redirect to intro page after logout
              router.replace('/intro');
            } catch (error) {
              console.error('Logout failed:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={{flex: 1}}>
  
        <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings.title')}</Text>
          <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.profile')}</Text>
            <View style={styles.profileCard}>
              <TouchableOpacity 
                style={styles.profileNavigationButton}
                onPress={() => router.push('/(tabs)/profile')}
              >
                <View style={styles.profileHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {userPreferences?.username.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{userPreferences?.username || 'Loading...'}</Text>
                    <Text style={styles.profileGoal}>
                      {t('settings.goal', { goal: userPreferences?.yearly_book_goal || 0 })}
                    </Text>
                    <Text style={styles.profileSubtext}>{t('settings.editProfile')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#6C63FF" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Language Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
            <LanguageSelector />
          </View>

          {/* Notifications Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
            <NotificationSettings />
          </View>

          {/* Development Notification Tester - Only show in development */}
          {__DEV__ && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🧪 Development Tools</Text>
              <NotificationTester />
            </View>
          )}

          {/* App Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
            <View style={styles.aboutCard}>
              <View style={styles.aboutItem}>
                <Ionicons name="information-circle-outline" size={24} color="#6C63FF" />
                <View style={styles.aboutInfo}>
                  <Text style={styles.aboutTitle}>{t('settings.appName')}</Text>
                  <Text style={styles.aboutSubtitle}>{t('settings.version')}</Text>
                </View>
              </View>
              <View style={styles.aboutItem}>
                <Ionicons name="book-outline" size={24} color="#10B981" />
                <View style={styles.aboutInfo}>
                  <Text style={styles.aboutTitle}>{t('settings.trackReading')}</Text>
                  <Text style={styles.aboutSubtitle}>{t('settings.builtForBookLovers')}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Logout Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
            <View style={styles.logoutCard}>
              <TouchableOpacity 
                style={styles.logoutBtn}
                onPress={handleLogout}
                disabled={loading}
              >
                <Ionicons name="log-out-outline" size={24} color="#EF4444" />
                <View style={styles.logoutInfo}>
                  <Text style={styles.logoutTitle}>{t('settings.logout')}</Text>
                  <Text style={styles.logoutSubtitle}>{t('settings.logoutDescription')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.copyright}>{t('settings.madeWithLove')}</Text>
          </View>
        </ScrollView>
      </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 24,
    marginTop: 40,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
    paddingLeft: 4,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  profileNavigationButton: {
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  profileGoal: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  editBtn: {
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 10,
  },
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  aboutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  aboutInfo: {
    marginLeft: 16,
    flex: 1,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  aboutSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingBottom: 40,
  },
  copyright: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  logoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  logoutInfo: {
    marginLeft: 16,
    flex: 1,
  },
  logoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 2,
  },
  logoutSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
