import { createContext, useContext, type ReactNode } from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProvider } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { authBaseUrl, authClient } from '../lib/auth-client';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex =
  convexUrl && convexUrl.trim().length > 0
    ? new ConvexReactClient(convexUrl)
    : null;
const authEnabled = Boolean(convex && authBaseUrl);

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

function BetterAuthStatusProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  return (
    <BackendAuthContext.Provider
      value={{
        authEnabled: true,
        isLoaded: !isPending,
        isSignedIn: Boolean(session?.session),
        userId: user?.id || null,
        email: user?.email || null,
        fullName: user?.name || null,
      }}
    >
      {children}
    </BackendAuthContext.Provider>
  );
}

export function BackendProviders({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <BackendAuthContext.Provider value={defaultBackendAuthState}>
        {children}
      </BackendAuthContext.Provider>
    );
  }

  return (
    <ConvexProvider client={convex}>
      {authEnabled ? (
        <ConvexBetterAuthProvider client={convex} authClient={authClient}>
          <BetterAuthStatusProvider>{children}</BetterAuthStatusProvider>
        </ConvexBetterAuthProvider>
      ) : (
        <BackendAuthContext.Provider value={defaultBackendAuthState}>
          {children}
        </BackendAuthContext.Provider>
      )}
    </ConvexProvider>
  );
}

export function useBackendAuth() {
  return useContext(BackendAuthContext);
}
