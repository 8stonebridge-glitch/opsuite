import { createContext, useContext, type ReactNode } from 'react';
import { ClerkProvider, useAuth, useUser } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

const convex =
  convexUrl && convexUrl.trim().length > 0
    ? new ConvexReactClient(convexUrl)
    : null;

interface BackendAuthState {
  clerkEnabled: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
}

const defaultBackendAuthState: BackendAuthState = {
  clerkEnabled: Boolean(clerkPublishableKey),
  isLoaded: !clerkPublishableKey,
  isSignedIn: false,
  userId: null,
  email: null,
  fullName: null,
};

const BackendAuthContext = createContext<BackendAuthState>(defaultBackendAuthState);

function ClerkStatusProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  return (
    <BackendAuthContext.Provider
      value={{
        clerkEnabled: true,
        isLoaded,
        isSignedIn: Boolean(isSignedIn),
        userId: user?.id || null,
        email: user?.primaryEmailAddress?.emailAddress || null,
        fullName: user?.fullName || null,
      }}
    >
      {children}
    </BackendAuthContext.Provider>
  );
}

function useConvexClerkAuth() {
  const auth = useAuth();

  return {
    ...auth,
    getToken: async ({ skipCache }: { skipCache?: boolean } = {}) => {
      try {
        const token = await auth.getToken({
          template: 'convex',
          skipCache,
        } as {
          template: string;
          skipCache?: boolean;
        });

        if (!token && auth.isSignedIn) {
          console.warn(
            'Clerk did not return a Convex token for the "convex" JWT template. Check the Clerk JWT template configuration.'
          );
        } else if (token) {
          console.log('Clerk returned a Convex token successfully.');
        }

        return token;
      } catch (error) {
        console.warn('Failed to fetch Clerk token for Convex.', error);
        return null;
      }
    },
  };
}

function ClerkConvexBridge({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useConvexClerkAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export function BackendProviders({ children }: { children: ReactNode }) {
  if (!clerkPublishableKey) {
    return (
      <BackendAuthContext.Provider value={defaultBackendAuthState}>
        {children}
      </BackendAuthContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ClerkStatusProvider>
        <ClerkConvexBridge>{children}</ClerkConvexBridge>
      </ClerkStatusProvider>
    </ClerkProvider>
  );
}

export function useBackendAuth() {
  return useContext(BackendAuthContext);
}
