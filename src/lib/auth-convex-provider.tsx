import React, { type ReactNode } from 'react';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
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
 * Wraps children with Clerk + Convex providers when real keys are set.
 * Falls back to passthrough when keys are placeholders (local dev mode).
 */
export function AuthConvexProvider({ children }: { children: ReactNode }) {
  // No real keys → local-only mode, just render children
  if (!isBackendEnabled || !CLERK_KEY || !convexClient) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
      <ClerkLoaded>
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
