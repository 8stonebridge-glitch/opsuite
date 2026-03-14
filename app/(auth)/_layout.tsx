import { Stack, Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { useApp } from '../../src/store/AppContext';

export default function AuthLayout() {
  const backendAuth = useBackendAuth();
  const { state } = useApp();

  if (backendAuth.authEnabled && !backendAuth.isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator color="#059669" />
      </View>
    );
  }

  if (state.isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
