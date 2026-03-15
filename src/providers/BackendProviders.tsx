import { createContext, useContext, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import { clerkPublishableKey, tokenCache } from '../lib/auth-client';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex =
  convexUrl && convexUrl.trim().length > 0
    ? new ConvexReactClient(convexUrl)
    : null;
const authEnabled = Boolean(convex && clerkPublishableKey);

interface BackendAuthState {
  authEnabled: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
}

const defaultBackendAuthState: BackendAuthState = {
  authEnabled,
  isLoaded: !authEnabled,
  isSignedIn: false,
  userId: null,
  email: null,
  fullName: null,
};

const BackendAuthContext = createContext<BackendAuthState>(defaultBackendAuthState);

function ClerkAuthStatusProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();

  return (
    <BackendAuthContext.Provider
      value={{
        authEnabled: true,
        isLoaded,
        isSignedIn: Boolean(isSignedIn),
        userId: userId || null,
        email: user?.primaryEmailAddress?.emailAddress || null,
        fullName: user?.fullName || user?.firstName || null,
      }}
    >
      {children}
    </BackendAuthContext.Provider>
  );
}

export function BackendProviders({ children }: { children: ReactNode }) {
  if (!convex || !clerkPublishableKey) {
    return (
      <BackendAuthContext.Provider value={defaultBackendAuthState}>
        {children}
      </BackendAuthContext.Provider>
    );
  }

  const clerkProps: Record<string, unknown> = {
    publishableKey: clerkPublishableKey,
  };
  // tokenCache is only for native (SecureStore)
  if (Platform.OS !== 'web' && tokenCache) {
    clerkProps.tokenCache = tokenCache;
  }

  return (
    <ClerkProvider {...clerkProps}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ClerkAuthStatusProvider>{children}</ClerkAuthStatusProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

export function useBackendAuth() {
  return useContext(BackendAuthContext);
}
