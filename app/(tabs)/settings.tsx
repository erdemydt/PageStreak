import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const settingsOptions = [
    { id: 1, title: 'Profile', subtitle: 'Manage your account', icon: 'person-outline' },
    { id: 2, title: 'Notifications', subtitle: 'Reading reminders & updates', icon: 'notifications-outline' },
    { id: 3, title: 'Reading Goals', subtitle: 'Set your reading targets', icon: 'trophy-outline' },
    { id: 4, title: 'Data Export', subtitle: 'Export your reading data', icon: 'download-outline' },
    { id: 5, title: 'Theme', subtitle: 'Customize app appearance', icon: 'color-palette-outline' },
    { id: 6, title: 'About', subtitle: 'App version and info', icon: 'information-circle-outline' },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ Settings</Text>
          <Text style={styles.subtitle}>Customize your PageStreak experience</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            {settingsOptions.map((option) => (
              <TouchableOpacity key={option.id} style={styles.settingItem}>
                <View style={styles.settingIcon}>
                  <Ionicons name={option.icon as any} size={22} color="#6C63FF" />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{option.title}</Text>
                  <Text style={styles.settingSubtitle}>{option.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="help-circle-outline" size={22} color="#10B981" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Help & FAQ</Text>
                <Text style={styles.settingSubtitle}>Get help and find answers</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="mail-outline" size={22} color="#F59E0B" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Contact Us</Text>
                <Text style={styles.settingSubtitle}>Send feedback or report issues</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.version}>PageStreak v1.0.0</Text>
            <Text style={styles.copyright}>Made with ❤️ for book lovers</Text>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 24,
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
  settingItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingBottom: 40,
  },
  version: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  copyright: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
