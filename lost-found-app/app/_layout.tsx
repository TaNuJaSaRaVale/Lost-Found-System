import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { auth } from '../services/firebase';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, ActivityIndicator, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from 'nativewind';
import { useTheme } from '../hooks/useTheme';

function AuthGuard() {
  const { colorScheme } = useColorScheme();
  const { isThemeLoading } = useTheme();
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading || isThemeLoading) return;

    if (profile?.status === 'blocked') {
      auth.signOut();
      Alert.alert('Access Denied', 'Your account has been blocked by an administrator.');
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const onIndex = segments.length === 0 || segments[0] === 'index';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && (inAuthGroup || onIndex)) {
      router.replace('/(tabs)/home');
    }
  }, [user, profile, loading, isThemeLoading, segments]);

  if (loading || isThemeLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ 
      headerShown: false,
      contentStyle: { backgroundColor: colorScheme === 'dark' ? '#111827' : '#F9FAFB' }
    }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="report-item" options={{ 
        presentation: 'modal', 
        headerShown: true, 
        title: 'Report Item',
        headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#FFFFFF' },
        headerTintColor: colorScheme === 'dark' ? '#F9FAFB' : '#111827'
      }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
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

