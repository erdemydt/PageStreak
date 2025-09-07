import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { execute, queryFirst } from '../../db/db';

type UserPreferences = {
  id: number;
  username: string;
  yearly_book_goal: number;
};

export default function SettingsScreen() {
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [editedGoal, setEditedGoal] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserPreferences();
  }, []);

  const loadUserPreferences = async () => {
    try {
      const user = await queryFirst<UserPreferences>('SELECT * FROM user_preferences WHERE id = 1');
      if (user) {
        setUserPreferences(user);
        setEditedUsername(user.username);
        setEditedGoal(user.yearly_book_goal.toString());
      }
    } catch (e) {
      console.error('Failed to load user preferences:', e);
    }
  };

  const savePreferences = async () => {
    if (!editedUsername.trim() || !editedGoal.trim() || isNaN(Number(editedGoal)) || Number(editedGoal) <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid username and yearly book goal');
      return;
    }

    setLoading(true);
    try {
      await execute(
        'UPDATE user_preferences SET username = ?, yearly_book_goal = ? WHERE id = 1',
        [editedUsername.trim(), Number(editedGoal)]
      );
      
      await loadUserPreferences();
      setIsEditing(false);
      Alert.alert('Success', 'Your preferences have been updated!');
    } catch (e) {
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    if (userPreferences) {
      setEditedUsername(userPreferences.username);
      setEditedGoal(userPreferences.yearly_book_goal.toString());
    }
    setIsEditing(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ Settings</Text>
          <Text style={styles.subtitle}>Manage your PageStreak preferences</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* User Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.profileCard}>
              {!isEditing ? (
                <>
                  <View style={styles.profileHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {userPreferences?.username.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.profileInfo}>
                      <Text style={styles.profileName}>{userPreferences?.username || 'Loading...'}</Text>
                      <Text style={styles.profileGoal}>
                        📖 Goal: {userPreferences?.yearly_book_goal || 0} books this year
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.editBtn}
                      onPress={() => setIsEditing(true)}
                    >
                      <Ionicons name="pencil" size={18} color="#6C63FF" />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.editForm}>
                  <Text style={styles.editFormTitle}>Edit Profile</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Username</Text>
                    <TextInput
                      style={styles.input}
                      value={editedUsername}
                      onChangeText={setEditedUsername}
                      placeholder="Enter your username"
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Yearly Book Goal</Text>
                    <TextInput
                      style={styles.input}
                      value={editedGoal}
                      onChangeText={setEditedGoal}
                      placeholder="e.g. 12"
                      keyboardType="numeric"
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.editActions}>
                    <TouchableOpacity 
                      style={styles.cancelBtn}
                      onPress={cancelEdit}
                      disabled={loading}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.saveBtn}
                      onPress={savePreferences}
                      disabled={loading}
                    >
                      <Text style={styles.saveBtnText}>
                        {loading ? 'Saving...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* App Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.aboutCard}>
              <View style={styles.aboutItem}>
                <Ionicons name="information-circle-outline" size={24} color="#6C63FF" />
                <View style={styles.aboutInfo}>
                  <Text style={styles.aboutTitle}>PageStreak</Text>
                  <Text style={styles.aboutSubtitle}>Version 1.0.0</Text>
                </View>
              </View>
              <View style={styles.aboutItem}>
                <Ionicons name="book-outline" size={24} color="#10B981" />
                <View style={styles.aboutInfo}>
                  <Text style={styles.aboutTitle}>Track Your Reading</Text>
                  <Text style={styles.aboutSubtitle}>Built for book lovers</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
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
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  editForm: {
    gap: 20,
  },
  editFormTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    height: 48,
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#1E293B',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 16,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#6C63FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
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
});
