import { useState, useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette } from '../constants/colors';

export type ThemePreference = 'light' | 'dark' | 'system';

export function useTheme() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();
  const [isThemeLoading, setIsThemeLoading] = useState(true);
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    async function loadTheme() {
      try {
        const savedTheme = await AsyncStorage.getItem('user-theme');
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setColorScheme(savedTheme);
          setPreference(savedTheme);
        }
      } catch (e) {
        console.error('Failed to load theme', e);
      } finally {
        setIsThemeLoading(false);
      }
    }
    loadTheme();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTheme = async (theme: ThemePreference) => {
    setColorScheme(theme);
    setPreference(theme);
    try {
      await AsyncStorage.setItem('user-theme', theme);
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  return {
    theme: colorScheme,
    preference,
    setTheme: changeTheme,
    toggleTheme: toggleColorScheme,
    isThemeLoading
  };
}

// Palette for the active color scheme, for props that can't take a className (icons, navigation).
export function useColors() {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? palette.dark : palette.light;
}
