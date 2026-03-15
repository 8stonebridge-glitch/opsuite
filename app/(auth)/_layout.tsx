import { Stack, Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { useApp } from '../../src/store/AppContext';

export default function AuthLayout() {
  const backendAuth = useBackendAuth();
  const { state } = useApp();

  if (backendAuth.authEnabled && !backendAuth.isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-950">
        <ActivityIndicator color="#059669" size="large" />
      </View>
    );
  }

  // Guard: backend says signed-in but local state hasn't synced yet —
  // hold the spinner so the sign-in form never flashes.
  if (backendAuth.authEnabled && backendAuth.isSignedIn && !state.isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-950">
        <ActivityIndicator color="#059669" size="large" />
      </View>
    );
  }

  // Guard: local state says authenticated but backend session hasn't confirmed yet
  if (state.isAuthenticated && backendAuth.authEnabled && !backendAuth.isSignedIn) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-950">
        <ActivityIndicator color="#059669" size="large" />
      </View>
    );
  }

  if (state.isAuthenticated) {
    let targetRoute = "/";
    switch (state.role) {
      case 'admin':
        targetRoute = "/(owner_admin)/overview";
        break;
      case 'subadmin':
        targetRoute = "/(subadmin)/overview";
        break;
      case 'employee':
        targetRoute = "/(employee)/my-day";
        break;
    }

    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-950">
        <ActivityIndicator color="#059669" size="large" />
        <Redirect href={targetRoute as any} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
