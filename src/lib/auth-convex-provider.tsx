import React, { type ReactNode } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { ClerkProvider, useAuth, useClerk } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { tokenCache } from './clerk-token-cache';

// ── Env vars ──────────────────────────────────────────────────────
const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

// ── Convex client (singleton) ─────────────────────────────────────
let convexClient: ConvexReactClient | null = null;
if (CONVEX_URL && CONVEX_URL !== 'https://REPLACE_ME.convex.cloud') {
  convexClient = new ConvexReactClient(CONVEX_URL);
}

// ── Feature flag: are real keys configured? ───────────────────────
export const isBackendEnabled =
  !!CLERK_KEY &&
  CLERK_KEY !== 'pk_test_REPLACE_ME' &&
  !!convexClient;

/**
 * Inner component that waits for Clerk to load before rendering Convex provider.
 * Uses useClerk().loaded instead of <ClerkLoaded> to avoid blocking forever on web.
 */
function ClerkConvexBridge({ children }: { children: ReactNode }) {
  const clerk = useClerk();

  if (!clerk.loaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <ConvexProviderWithClerk client={convexClient!} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

/**
 * Wraps children with Clerk + Convex providers when real keys are set.
 * Falls back to passthrough when keys are placeholders (local dev mode).
 */
export function AuthConvexProvider({ children }: { children: ReactNode }) {
  // No real keys → local-only mode, just render children
  if (!isBackendEnabled || !CLERK_KEY || !convexClient) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_KEY}
      tokenCache={Platform.OS !== 'web' ? tokenCache : undefined}
    >
      <ClerkConvexBridge>
        {children}
      </ClerkConvexBridge>
    </ClerkProvider>
  );
}
