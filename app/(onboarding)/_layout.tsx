import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { useApp } from '../../src/store/AppContext';

export default function OnboardingLayout() {
  const backendAuth = useBackendAuth();
  const { state } = useApp();

  if (backendAuth.authEnabled && !backendAuth.isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator color="#059669" />
      </View>
    );
  }

  // Keep the legacy onboarding wizard only when external auth is not active.
  if (backendAuth.authEnabled) {
    return <Redirect href={state.isAuthenticated ? '/' : '/(auth)/sign-in'} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
