import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/expo';
import { useApp } from '../src/store/AppContext';
import { useBackendAuth } from '../src/providers/BackendProviders';

function RestoringSessionScreen({
  onLocalSignOut,
  onForceSignIn,
}: {
  onLocalSignOut: () => void;
  onForceSignIn: () => void;
}) {
  const { signOut } = useClerk();
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [showBypass, setShowBypass] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBypass(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  const handleReset = async () => {
    setResetError('');
    setIsResetting(true);

    try {
      await signOut();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'We could not reset the session just yet.');
    } finally {
      onLocalSignOut();
      onForceSignIn();
      setIsResetting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 items-center justify-center">
        <View className="w-16 h-16 rounded-3xl bg-emerald-50 items-center justify-center mb-6">
          <ActivityIndicator size="small" color="#059669" />
        </View>
        <Text className="text-2xl font-bold tracking-tight text-gray-900 text-center mb-2">
          Restoring your workspace
        </Text>
        <Text className="text-base text-gray-500 text-center leading-6 mb-8">
          Your account session is active. We&apos;re reconnecting it to the app data now.
        </Text>
        <Pressable
          onPress={handleReset}
          disabled={isResetting}
          className={`w-full rounded-2xl py-4 items-center justify-center ${isResetting ? 'bg-gray-200' : 'bg-gray-900'}`}
        >
          <Text className="text-white font-semibold text-base">
            {isResetting ? 'Resetting session...' : 'Reset sign-in'}
          </Text>
        </Pressable>
        <Text className="text-sm text-gray-400 text-center mt-4">
          If this screen stays here, the Clerk to Convex connection still needs attention.
        </Text>
        {showBypass ? (
          <Pressable onPress={onForceSignIn} className="mt-4">
            <Text className="text-sm font-semibold text-emerald-600">Go to sign in instead</Text>
          </Pressable>
        ) : null}
        {resetError ? (
          <Text className="text-sm text-red-600 text-center mt-3">{resetError}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export default function Index() {
  const { state, dispatch } = useApp();
  const { clerkEnabled, isLoaded, isSignedIn } = useBackendAuth();
  const shouldUseLegacyOnboarding = !clerkEnabled;

  if (!state.isAuthenticated && clerkEnabled && isLoaded && isSignedIn) {
    return (
      <RestoringSessionScreen
        onLocalSignOut={() => {
          dispatch({ type: 'SIGN_OUT' });
        }}
        onForceSignIn={() => {
          dispatch({ type: 'SIGN_OUT' });
        }}
      />
    );
  }

  if (!state.isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (clerkEnabled && !isLoaded) {
    return (
      <RestoringSessionScreen
        onLocalSignOut={() => {
          dispatch({ type: 'SIGN_OUT' });
        }}
        onForceSignIn={() => {
          dispatch({ type: 'SIGN_OUT' });
        }}
      />
    );
  }

  if (!state.onboardingComplete && shouldUseLegacyOnboarding) {
    return <Redirect href="/(onboarding)/org-name" />;
  }

  switch (state.role) {
    case 'admin':
      return <Redirect href="/(owner_admin)/overview" />;
    case 'subadmin':
      return <Redirect href="/(subadmin)/overview" />;
    case 'employee':
      return <Redirect href="/(employee)/my-day" />;
    default:
      return <Redirect href="/(auth)/sign-in" />;
  }
}
