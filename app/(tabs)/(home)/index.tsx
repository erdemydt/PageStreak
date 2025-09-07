
import { Link, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { execute, queryAll } from '../../../db/db';


type User = { id: number; username: string };

export default function HomeScreen() {
  const [username, setUsername] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create table if not exists
  useEffect(() => {
    (async () => {
      await execute(
        'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE)'
      );
      await loadUsers();
    })();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await queryAll<User>('SELECT * FROM users ORDER BY id DESC');
      console.log('Loaded users:', res);
      setUsers(res);
    } catch (e) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const saveUser = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await execute('INSERT INTO users (username) VALUES (?)', [username.trim()]);
      setUsername('');
      Keyboard.dismiss();
      await loadUsers();
    } catch (e: any) {
      if (e?.message?.includes('UNIQUE')) {
        setError('Username already exists');
      } else {
        setError('Failed to save user');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Home' }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📚 PageStreak</Text>
          <Text style={styles.subtitle}>Track your reading journey</Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add New User</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Enter username"
              placeholderTextColor="#9CA3AF"
              value={username}
              onChangeText={setUsername}
              editable={!loading}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={saveUser}
              returnKeyType="done"
            />
            <TouchableOpacity 
              style={[styles.saveBtn, (!username.trim() || loading) && styles.saveBtnDisabled]} 
              onPress={saveUser} 
              disabled={loading || !username.trim()}
            >
              <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>👥 Registered Users ({users.length})</Text>
          <FlatList
            data={users}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.userItem}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.userText}>{item.username}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👤</Text>
                <Text style={styles.emptyTitle}>No users yet</Text>
                <Text style={styles.emptySubtitle}>Add your first user above!</Text>
              </View>
            }
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </View>
        
        <View style={styles.linkContainer}>
          <Link
            href={{ pathname: '/details/[id]', params: { id: 'bacon' } }}
            style={styles.link}
          >
            <Text style={styles.linkText}>View user details →</Text>
          </Link>
        </View>
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
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    height: 48,
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#1E293B',
  },
  saveBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  error: {
    color: '#EF4444',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  listSection: {
    flex: 1,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  list: {
    flex: 1,
  },
  userItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  linkContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
  link: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  linkText: {
    color: '#6C63FF',
    fontWeight: '600',
    fontSize: 16,
  },
});
