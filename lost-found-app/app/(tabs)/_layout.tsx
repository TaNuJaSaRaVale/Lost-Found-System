import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useColorScheme } from 'nativewind';

export default function TabLayout() {
  const { profile, isAdminMode } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#6366F1', // primary color
        tabBarInactiveTintColor: isDark ? '#6B7280' : '#9CA3AF', 
        tabBarStyle: {
          backgroundColor: isDark ? '#1F2937' : '#ffffff',
          borderTopColor: isDark ? '#374151' : '#f3f4f6',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerStyle: {
          backgroundColor: isDark ? '#1F2937' : '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#374151' : '#f3f4f6',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          color: isDark ? '#F9FAFB' : '#1f2937',
        }
      }}>
      <Tabs.Screen
        name="home"
        options={{
          headerTitle: () => (
            <Image 
              source={require('../../assets/images/logo.png')} 
              style={{ width: 120, height: 40 }}
              resizeMode="contain"
            />
          ),
          tabBarLabel: 'Lost',
          tabBarIcon: ({ color }) => <Ionicons name="search" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="found"
        options={{
          title: 'Found Items',
          tabBarIcon: ({ color }) => <Ionicons name="sparkles" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color }) => <Ionicons name="git-compare" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          href: isAdminMode ? null : '/(tabs)/report',
          title: 'Report',
          tabBarIcon: ({ color }) => <Ionicons name="add-circle" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: isAdminMode ? '/(tabs)/admin' : null,
          title: 'Admin',
          tabBarIcon: ({ color }) => <Ionicons name="shield-checkmark" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
