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

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync();
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
        <AppProvider>
          <InboxProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(owner_admin)" />
              <Stack.Screen name="(subadmin)" />
              <Stack.Screen name="(employee)" />
            </Stack>
            <InboxSheet />
          </InboxProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
