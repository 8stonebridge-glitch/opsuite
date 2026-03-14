import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useClerk } from '@clerk/expo';
import { useSignIn } from '@clerk/expo/legacy';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { getClerkErrorMessage, hashPassword, validateEmail } from '../../src/utils/auth';
import { useOwnerSessionBootstrap } from '../../src/hooks/useOwnerSessionBootstrap';

export default function SignInScreen() {
  const { dispatch, findAccountByEmail } = useApp();
  const router = useRouter();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();
  const backendAuth = useBackendAuth();
  const bootstrapOwnerSession = useOwnerSessionBootstrap();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearingSession, setIsClearingSession] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const isDemoAccount = normalizedEmail === 'owner@opsuite.demo';
  const isConvexAuthPendingMessage = (message: string) =>
    message.includes('Convex is still waiting for the auth token');

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

    if (!isLoaded || !signIn || !setActive) {
      setError('Authentication is still loading. Please try again in a moment.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignedIn) {
        await signOut();
        dispatch({ type: 'SIGN_OUT' });
      }

      const result = await signIn.create({
        identifier: normalizedEmail,
        password,
      });

      if (result.status !== 'complete' || !result.createdSessionId) {
        throw new Error('This account needs another verification step before sign-in can finish.');
      }

      await setActive({ session: result.createdSessionId });
      try {
        await bootstrapOwnerSession({
          clerkUserId: normalizedEmail,
          name: result.userData.firstName && result.userData.lastName
            ? `${result.userData.firstName} ${result.userData.lastName}`.trim()
            : result.userData.firstName || result.userData.lastName || 'Owner',
          email: normalizedEmail,
        });
      } catch (bootstrapError) {
        const bootstrapMessage = getClerkErrorMessage(bootstrapError, '');
        if (!isConvexAuthPendingMessage(bootstrapMessage)) {
          throw bootstrapError;
        }
      }
      router.replace('/');
    } catch (err) {
      setError(getClerkErrorMessage(err, 'We could not sign you in.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseCurrentSession = async () => {
    setError('');

    if (isDemoAccount) {
      router.replace('/');
      return;
    }

    if (!backendAuth.userId || !backendAuth.email) {
      setError('The current session is still loading. Please wait a moment and try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      try {
        await bootstrapOwnerSession({
          clerkUserId: backendAuth.userId,
          name: backendAuth.fullName || 'Owner',
          email: backendAuth.email,
        });
      } catch (bootstrapError) {
        const bootstrapMessage = getClerkErrorMessage(bootstrapError, '');
        if (!isConvexAuthPendingMessage(bootstrapMessage)) {
          throw bootstrapError;
        }
      }
      router.replace('/');
    } catch (err) {
      setError(getClerkErrorMessage(err, 'We could not restore the current session yet.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearCurrentSession = async () => {
    setError('');
    setIsClearingSession(true);

    try {
      await signOut();
    } catch (err) {
      setError(getClerkErrorMessage(err, 'We could not clear the current session just yet.'));
    } finally {
      dispatch({ type: 'SIGN_OUT' });
      setIsClearingSession(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
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
            <Text className="text-3xl font-bold tracking-tight text-gray-900">
              OpSuite
            </Text>
            <Text className="text-base text-gray-400 mt-1">
              Operations management
            </Text>
          </View>

          {isSignedIn ? (
            <View className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <Text className="text-sm font-semibold text-amber-900 mb-1">
                You’re already signed in
              </Text>
              <Text className="text-sm leading-6 text-amber-800">
                There is already an active Clerk session on this device. You can continue with it or clear it before signing in again.
              </Text>
              <View className="mt-4 gap-3">
                <Button
                  title={isSubmitting ? 'Restoring session...' : 'Continue with current session'}
                  onPress={handleUseCurrentSession}
                  disabled={isSubmitting || isClearingSession}
                  className="w-full"
                />
                <Button
                  title={isClearingSession ? 'Clearing session...' : 'Sign out current session'}
                  onPress={handleClearCurrentSession}
                  disabled={isClearingSession}
                  variant="outline"
                  className="w-full"
                />
              </View>
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
            />
            <Input
              label="Password"
              placeholder="Enter password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError('');
              }}
              secureTextEntry
            />
          </View>

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            className="self-end mb-6"
          >
            <Text className="text-sm font-semibold text-emerald-600">
              Forgot password?
            </Text>
          </Pressable>

          {error ? (
            <View className="flex-row items-center gap-2 mb-4 px-1">
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text className="text-sm text-red-600">{error}</Text>
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
            <Text className="text-sm text-gray-400">
              Don't have an account?{' '}
              <Text className="text-emerald-600 font-semibold">Sign Up</Text>
            </Text>
          </Pressable>

          <View className="mt-10 p-4 bg-gray-50 rounded-2xl">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Demo Account
            </Text>
            <Text className="text-sm text-gray-500">
              Email: <Text className="font-medium text-gray-700">owner@opsuite.demo</Text>
            </Text>
            <Text className="text-sm text-gray-500 mt-1">
              Password: <Text className="font-medium text-gray-700">demo1234</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
