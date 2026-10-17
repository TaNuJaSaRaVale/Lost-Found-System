import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useColors } from '../../hooks/useTheme';

export default function TabLayout() {
  const { user, isAdminMode } = useAuth();
  const colors = useColors();
  const [pendingReviews, setPendingReviews] = useState(0);

  // Badge on the Profile tab: claims waiting for this user's decision.
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'claims'), where('ownerId', '==', user.uid), where('status', '==', 'pending'));
    return onSnapshot(q, snap => setPendingReviews(snap.size), () => setPendingReviews(0));
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerStyle: {
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        },
        headerTitleStyle: { fontWeight: 'bold', color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          headerShown: false,
          title: 'Lost',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="found"
        options={{
          headerShown: false,
          title: 'Found',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          href: isAdminMode ? null : '/(tabs)/report',
          title: 'Report',
          tabBarIcon: ({ color }) => <Ionicons name="add-circle" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'git-compare' : 'git-compare-outline'} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: isAdminMode ? '/(tabs)/admin' : null,
          title: 'Admin',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarBadge: pendingReviews > 0 ? pendingReviews : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
