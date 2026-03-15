import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSignIn, useAuth } from '../../src/lib/clerk';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { getAuthErrorMessage, hashPassword, validateEmail } from '../../src/utils/auth';
import { withTimeout } from '../../src/utils/promise';
import { useOwnerSessionBootstrap } from '../../src/hooks/useOwnerSessionBootstrap';

export default function SignInScreen() {
  const { state, dispatch, findAccountByEmail } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ verified?: string; checkEmail?: string }>();
  const backendAuth = useBackendAuth();
  const bootstrapOwnerSession = useOwnerSessionBootstrap();
  const { signIn, setActive, isLoaded: clerkLoaded } = useSignIn();
  const { signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    setEmail('');
    setPassword('');
    setError('');
  }, []);

  // If user is already authenticated (e.g. came from sign-up verification),
  // redirect to the index page which will route them to the correct dashboard.
  useEffect(() => {
    if (state.isAuthenticated && !state.isDemo) {
      router.replace('/');
    }
  }, [state.isAuthenticated, state.isDemo, router]);

  const normalizedEmail = email.trim().toLowerCase();
  const isDemoAccount = normalizedEmail === 'owner@opsuite.demo';

  const handleSignIn = async () => {
    setError('');

    if (!validateEmail(email)) {
      setError('Enter a valid work email address.');
      return;
    }

    if (password.trim().length < 1) {
      setError('Enter your password to continue.');
      return;
    }

    if (isDemoAccount) {
      const account = findAccountByEmail(normalizedEmail);
      if (!account) {
        setError('No demo account was found on this device.');
        return;
      }
      if (account.passwordHash !== hashPassword(password)) {
        setError('Incorrect password');
        return;
      }
      dispatch({ type: 'SIGN_IN', accountId: account.id });
      router.replace('/');
      return;
    }

    if (!clerkLoaded || !signIn) {
      setError('Auth is still loading. Please wait a moment.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Clear any hanging Clerk session to prevent "already signed in" errors
      try {
        await signOut();
      } catch (e) {
        // Ignore sign-out errors since we're just ensuring clean state
      }

      const result = await withTimeout(
        signIn.create({
          identifier: normalizedEmail,
          password,
        }),
        12000,
        'Sign in timed out — security check may have failed. Please refresh and try again.',
      );

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        // Navigate immediately — index page handles the loading state
        // while SessionBridge syncs in the background.
        router.replace('/');
        return;
      } else {
        setError('Sign-in incomplete. Please try again.');
      }
    } catch (err: any) {
      const clerkErrors = err?.errors;
      if (Array.isArray(clerkErrors) && clerkErrors.length > 0) {
        setError(clerkErrors[0].longMessage || clerkErrors[0].message || 'We could not sign you in.');
      } else {
        setError(getAuthErrorMessage(err, 'We could not sign you in.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isNavigatingAway) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#059669" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
          keyboardShouldPersistTaps="always"
        >
          <View className="items-center mb-12">
            <View className="w-16 h-16 rounded-3xl bg-emerald-600 items-center justify-center mb-4">
              <Ionicons name="briefcase" size={32} color="white" />
            </View>
            <Text className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              OpSuite
            </Text>
            <Text className="text-base text-gray-400 dark:text-gray-500 mt-1">
              Operations management
            </Text>
          </View>

          {params.verified ? (
            <View className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-4">
              <Text className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                Email confirmed
              </Text>
              <Text className="text-sm leading-6 text-emerald-800 dark:text-emerald-300">
                Your account is verified. Sign in to finish opening your workspace.
              </Text>
            </View>
          ) : null}

          {params.checkEmail ? (
            <View className="mb-6 rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950 p-4">
              <Text className="text-sm font-semibold text-sky-900 dark:text-sky-200 mb-1">
                Check your inbox
              </Text>
              <Text className="text-sm leading-6 text-sky-800 dark:text-sky-300">
                We sent a confirmation email. Open the link there, then return here to sign in.
              </Text>
            </View>
          ) : null}

          <View className="gap-4 mb-6">
            <Input
              label="Work Email"
              placeholder="you@company.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Input
              ref={passwordRef}
              label="Password"
              placeholder="Enter password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError('');
              }}
              secureTextEntry
              autoComplete="off"
              returnKeyType="go"
              onSubmitEditing={handleSignIn}
            />
          </View>

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            className="self-end mb-6"
          >
            <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Forgot password?
            </Text>
          </Pressable>

          {error ? (
            <View className="flex-row items-center gap-2 mb-4 px-1">
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text>
            </View>
          ) : null}

          <Button
            title={isSubmitting ? 'Signing in...' : 'Sign In'}
            onPress={handleSignIn}
            disabled={isSubmitting}
            className="w-full"
          />

          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            className="mt-6 items-center"
          >
            <Text className="text-sm text-gray-400 dark:text-gray-500">
              Don't have an account?{' '}
              <Text className="text-emerald-600 dark:text-emerald-400 font-semibold">Sign Up</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
