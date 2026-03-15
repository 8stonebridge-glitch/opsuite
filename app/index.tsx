import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/lib/clerk';
import { useApp } from '../src/store/AppContext';
import { useBackendAuth } from '../src/providers/BackendProviders';

function SilentLoadingScreen({
  onTimeout,
}: {
  onTimeout: () => void;
}) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFallback(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#059669" />
        {showFallback ? (
          <View className="mt-8 items-center px-6">
            <Text className="text-sm text-gray-400 dark:text-gray-500 text-center mb-4">
              Taking longer than expected.
            </Text>
            <Pressable onPress={onTimeout}>
              <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Go to sign in</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export default function Index() {
  const { state, dispatch } = useApp();
  const { authEnabled, isLoaded, isSignedIn } = useBackendAuth();
  const { signOut } = useAuth();
  const shouldUseLegacyOnboarding = !authEnabled;

  const handleForceSignIn = () => {
    signOut().catch(() => {});
    dispatch({ type: 'SIGN_OUT' });
  };

  // Auth still loading after local state is set — show silent spinner
  if (authEnabled && !isLoaded) {
    return <SilentLoadingScreen onTimeout={handleForceSignIn} />;
  }

  // Backend auth hint loaded from localStorage but not yet confirmed by
  // the real Convex session — hold here instead of routing with stale data
  if (state.pendingBackendAuth && authEnabled) {
    return <SilentLoadingScreen onTimeout={handleForceSignIn} />;
  }

  // Auth session exists but local state not yet synced — show silent spinner
  // while SessionBridge syncs in the background
  if (!state.isAuthenticated && authEnabled && isLoaded && isSignedIn) {
    return <SilentLoadingScreen onTimeout={handleForceSignIn} />;
  }

  if (!state.isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
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
