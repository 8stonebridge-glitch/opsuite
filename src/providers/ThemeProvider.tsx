import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@opsuite/theme';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colorScheme: 'light' | 'dark' | undefined;
  isDark: boolean;
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (scheme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: 'light',
  isDark: false,
  preference: 'system',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');

  // Restore saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setPreference(saved);
          setColorScheme(saved);
        }
      })
      .catch(() => {});
  }, [setColorScheme]);

  const toggleTheme = () => {
    toggleColorScheme();
    const next = colorScheme === 'dark' ? 'light' : 'dark';
    setPreference(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  };

  const setTheme = (scheme: ThemePreference) => {
    setPreference(scheme);
    setColorScheme(scheme);
    AsyncStorage.setItem(THEME_KEY, scheme).catch(() => {});
  };

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        isDark: colorScheme === 'dark',
        preference,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
