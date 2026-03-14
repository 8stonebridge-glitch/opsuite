import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { useTheme } from '../../src/providers/ThemeProvider';
import { authClient } from '../../src/lib/auth-client';
import { Button } from '../../src/components/ui/Button';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { dispatch } = useApp();
  const { isSignedIn } = useBackendAuth();
  const { isDark } = useTheme();

  const handleClearCurrentSession = async () => {
    try {
      await authClient.signOut();
    } finally {
      dispatch({ type: 'SIGN_OUT' });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 mb-6"
          >
            <Ionicons name="arrow-back" size={18} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text className="text-sm text-gray-400 dark:text-gray-500">Back</Text>
          </Pressable>

          <Text className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
            Password reset
          </Text>
          <Text className="text-base text-gray-400 dark:text-gray-500 mb-8">
            This Convex Auth build has email/password sign-in enabled, but password reset email delivery is not configured yet.
          </Text>

          <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6">
            <Text className="text-sm font-semibold text-amber-900 mb-1">
              Reset not configured
            </Text>
            <Text className="text-sm leading-6 text-amber-800">
              For now, use a known test account or have us wire an email provider for Better Auth before launch.
            </Text>
          </View>

          <View className="gap-3">
            <Button
              title="Back to sign in"
              onPress={() => router.replace('/(auth)/sign-in')}
              className="w-full"
            />
            {isSignedIn ? (
              <Button
                title="Sign out current session"
                onPress={handleClearCurrentSession}
                variant="outline"
                className="w-full"
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
