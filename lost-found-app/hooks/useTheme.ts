import { useState, useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useTheme() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();
  const [isThemeLoading, setIsThemeLoading] = useState(true);

  useEffect(() => {
    async function loadTheme() {
      try {
        const savedTheme = await AsyncStorage.getItem('user-theme');
        if (savedTheme) {
          setColorScheme(savedTheme as 'light' | 'dark' | 'system');
        }
      } catch (e) {
        console.error('Failed to load theme', e);
      } finally {
        setIsThemeLoading(false);
      }
    }
    loadTheme();
  }, []);

  const changeTheme = async (theme: 'light' | 'dark' | 'system') => {
    setColorScheme(theme);
    try {
      await AsyncStorage.setItem('user-theme', theme);
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  return {
    theme: colorScheme,
    setTheme: changeTheme,
    toggleTheme: toggleColorScheme,
    isThemeLoading
  };
}
