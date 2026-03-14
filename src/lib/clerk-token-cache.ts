import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { TokenCache } from '@clerk/clerk-expo';

/**
 * Clerk token cache using expo-secure-store on native,
 * falls back to no-op on web (Clerk handles web tokens itself).
 */
function createTokenCache(): TokenCache {
  return {
    async getToken(key: string) {
      if (Platform.OS === 'web') return null;
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    async saveToken(key: string, value: string) {
      if (Platform.OS === 'web') return;
      try {
        await SecureStore.setItemAsync(key, value);
      } catch {
        // Silently fail — token will be refreshed next launch
      }
    },
    async clearToken(key: string) {
      if (Platform.OS === 'web') return;
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // noop
      }
    },
  };
}

export const tokenCache = createTokenCache();
