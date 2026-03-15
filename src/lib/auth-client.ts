// Clerk auth client — replaces Better Auth.
// The actual ClerkProvider is set up in BackendProviders.tsx.
// This file exports the publishable key and token cache for Convex.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { TokenCache } from '@clerk/clerk-expo';

export const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

const createTokenCache = (): TokenCache => {
  return {
    getToken: async (key: string) => {
      try {
        const item = await SecureStore.getItemAsync(key);
        return item;
      } catch {
        await SecureStore.deleteItemAsync(key);
        return null;
      }
    },
    saveToken: (key: string, token: string) => {
      return SecureStore.setItemAsync(key, token);
    },
    clearToken: (key: string) => {
      return SecureStore.deleteItemAsync(key);
    },
  };
};

// Only use SecureStore on native; web uses cookies automatically
export const tokenCache = Platform.OS !== 'web' ? createTokenCache() : undefined;
