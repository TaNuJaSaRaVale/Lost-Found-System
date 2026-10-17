import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import 'react-native-reanimated';
import '../global.css';
import '../components/interop';

import { auth } from '../services/firebase';
import { registerForPushNotificationsAsync } from '../services/notification';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useTheme, useColors } from '../hooks/useTheme';

const HANDLED_NOTIFICATION_KEY = 'last-handled-notification';

function useNotificationRouting(ready: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    const open = (response: Notifications.NotificationResponse) => {
      const data: any = response.notification.request.content.data;
      AsyncStorage.setItem(HANDLED_NOTIFICATION_KEY, response.notification.request.identifier).catch(() => {});
      if (data?.claimId && data?.screen === 'chat') router.push(`/chat/${data.claimId}`);
      else if (data?.itemId && data?.itemType) router.push({ pathname: '/item/[id]', params: { id: data.itemId, type: data.itemType } });
      else if (data?.screen === 'matches') router.push('/(tabs)/matches');
    };
    // App was launched by tapping a notification (skip if we already handled that one)
    Notifications.getLastNotificationResponseAsync().then(async response => {
      if (!response) return;
      const handled = await AsyncStorage.getItem(HANDLED_NOTIFICATION_KEY).catch(() => null);
      if (handled !== response.notification.request.identifier) open(response);
    });
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [ready, router]);
}

function AuthGuard() {
  const colors = useColors();
  const { isThemeLoading } = useTheme();
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const registeredFor = useRef<string | null>(null);
  const blockedAlertShown = useRef(false);

  useNotificationRouting(!loading && !isThemeLoading && !!user);

  useEffect(() => {
    if (loading || isThemeLoading) return;

    if (profile?.status === 'blocked') {
      auth.signOut();
      if (!blockedAlertShown.current) {
        blockedAlertShown.current = true;
        Alert.alert('Account suspended', 'Your account has been suspended by an administrator. Contact your campus admin if you think this is a mistake.');
      }
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const onIndex = (segments as string[]).length === 0;

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && (inAuthGroup || onIndex)) {
      blockedAlertShown.current = false;
      router.replace('/(tabs)/home');
    }
  }, [user, profile, loading, isThemeLoading, segments, router]);

  // Register for push once per signed-in user, unless they turned notifications off.
  useEffect(() => {
    if (!user || !profile || registeredFor.current === user.uid) return;
    registeredFor.current = user.uid;
    if (profile.notificationsEnabled !== false) registerForPushNotificationsAsync();
  }, [user, profile]);

  if (loading || isThemeLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="report-item"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Report item',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AuthGuard />
      </AuthProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </GestureHandlerRootView>
  );
}
