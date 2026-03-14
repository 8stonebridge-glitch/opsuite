import '../global.css';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider } from '../src/store/AppContext';
import { InboxProvider } from '../src/components/inbox/InboxProvider';
import { InboxSheet } from '../src/components/inbox/InboxSheet';
import { BackendProviders } from '../src/providers/BackendProviders';
import { SessionBridge } from '../src/providers/SessionBridge';
import { ThemeProvider, useTheme } from '../src/providers/ThemeProvider';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync();
}

function RootContent() {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(owner_admin)" />
        <Stack.Screen name="(subadmin)" />
        <Stack.Screen name="(employee)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <InboxSheet />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      SplashScreen.hideAsync();
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BackendProviders>
          <AppProvider>
            <SessionBridge />
            <ThemeProvider>
              <InboxProvider>
                <RootContent />
              </InboxProvider>
            </ThemeProvider>
          </AppProvider>
        </BackendProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
