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

  // Local state says authenticated but backend session hasn't confirmed yet —
  // hold on the spinner to avoid a brief flash of the sign-in form.
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
