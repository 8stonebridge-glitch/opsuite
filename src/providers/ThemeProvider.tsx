import React, { createContext, useContext, useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@opsuite/theme';

interface ThemeContextValue {
  colorScheme: 'light' | 'dark' | undefined;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (scheme: 'light' | 'dark' | 'system') => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();

  // Restore saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setColorScheme(saved);
        }
      })
      .catch(() => {});
  }, [setColorScheme]);

  const toggleTheme = () => {
    toggleColorScheme();
    const next = colorScheme === 'dark' ? 'light' : 'dark';
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  };

  const setTheme = (scheme: 'light' | 'dark' | 'system') => {
    setColorScheme(scheme);
    AsyncStorage.setItem(THEME_KEY, scheme).catch(() => {});
  };

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        isDark: colorScheme === 'dark',
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
