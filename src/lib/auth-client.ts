import * as SecureStore from 'expo-secure-store';
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

function deriveConvexSiteUrl(convexUrl?: string | null) {
  if (!convexUrl) return null;
  return convexUrl.replace('.convex.cloud', '.convex.site');
}

export const authBaseUrl =
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL?.trim() ||
  deriveConvexSiteUrl(process.env.EXPO_PUBLIC_CONVEX_URL?.trim()) ||
  null;

export const emailVerificationCallbackUrl = authBaseUrl
  ? `${authBaseUrl.replace(/\/$/, '')}/email-confirmed`
  : 'http://localhost/email-confirmed';

export const authClient = createAuthClient({
  baseURL: authBaseUrl || 'http://localhost',
  plugins: [
    convexClient(),
    expoClient({
      scheme: 'taskhub',
      storagePrefix: 'taskhub',
      storage: SecureStore,
    }),
  ],
});
