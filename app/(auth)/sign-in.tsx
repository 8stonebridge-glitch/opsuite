import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { authClient, emailVerificationCallbackUrl } from '../../src/lib/auth-client';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { getAuthErrorMessage, hashPassword, validateEmail } from '../../src/utils/auth';
import { useOwnerSessionBootstrap } from '../../src/hooks/useOwnerSessionBootstrap';

export default function SignInScreen() {
  const { state, dispatch, findAccountByEmail } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ verified?: string; checkEmail?: string }>();
  const backendAuth = useBackendAuth();
  const bootstrapOwnerSession = useOwnerSessionBootstrap();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearingSession, setIsClearingSession] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isRestoringWorkspace, setIsRestoringWorkspace] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const isDemoAccount = normalizedEmail === 'owner@opsuite.demo';
  const isConvexAuthPendingMessage = (message: string) =>
    message.includes('Convex is still waiting for the auth token');
  const isEmailVerificationMessage = (message: string) => {
    const normalizedMessage = message.toLowerCase();
    return normalizedMessage.includes('email not verified') || normalizedMessage.includes('verify your email');
  };

  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const finishWorkspaceBootstrap = async ({
    authUserId,
    name,
    email,
  }: {
    authUserId: string;
    name: string;
    email: string;
  }) => {
    const timeoutMs = 12000;
    const pollMs = 400;
    const startedAt = Date.now();
    let lastPendingMessage = '';

    while (Date.now() - startedAt < timeoutMs) {
      if (state.isAuthenticated) {
        return;
      }

      try {
        await bootstrapOwnerSession({
          authUserId,
          name,
          email,
        });
        await pause(0);
        return;
      } catch (bootstrapError) {
        const bootstrapMessage = getAuthErrorMessage(bootstrapError, '');
        if (!isConvexAuthPendingMessage(bootstrapMessage)) {
          throw bootstrapError;
        }
        lastPendingMessage = bootstrapMessage;
      }

      await pause(pollMs);
    }

    throw new Error(
      lastPendingMessage ||
        'Your session is active, but your workspace is taking longer than expected to reconnect. Please try again.'
    );
  };

  const handleResendVerification = async () => {
    if (!validateEmail(email)) {
      setError('Enter the email address you signed up with first.');
      return;
    }

    setError('');
    setNeedsEmailVerification(true);
    setIsResendingVerification(true);

    try {
      const result = await authClient.sendVerificationEmail({
        email: normalizedEmail,
        callbackURL: emailVerificationCallbackUrl,
      });

      if (result.error) {
        throw new Error(result.error.message || 'We could not resend the verification email.');
      }
    } catch (err) {
      setError(getAuthErrorMessage(err, 'We could not resend the verification email.'));
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleSignIn = async () => {
    setError('');
    setNeedsEmailVerification(false);

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

    setIsSubmitting(true);
    setIsRestoringWorkspace(false);

    try {
      if (backendAuth.isSignedIn) {
        await authClient.signOut();
        dispatch({ type: 'SIGN_OUT' });
      }

      const result = await authClient.signIn.email({
        email: normalizedEmail,
        password,
        rememberMe: true,
      });

      if (result.error) {
        throw new Error(result.error.message || 'We could not sign you in.');
      }

      setIsRestoringWorkspace(true);
      await finishWorkspaceBootstrap({
        authUserId: result.data?.user?.id || normalizedEmail,
        name: result.data?.user?.name || 'Owner',
        email: normalizedEmail,
      });
      router.replace('/');
    } catch (err) {
      const message = getAuthErrorMessage(err, 'We could not sign you in.');
      if (isEmailVerificationMessage(message)) {
        setNeedsEmailVerification(true);
        setError('Your email still needs confirmation. Check your inbox, then come back and sign in.');
        return;
      }
      setError(message);
    } finally {
      setIsRestoringWorkspace(false);
      setIsSubmitting(false);
    }
  };

  const handleUseCurrentSession = async () => {
    setError('');
    setNeedsEmailVerification(false);

    if (isDemoAccount) {
      router.replace('/');
      return;
    }

    if (!backendAuth.userId || !backendAuth.email) {
      setError('The current session is still loading. Please wait a moment and try again.');
      return;
    }

    setIsSubmitting(true);
    setIsRestoringWorkspace(false);

    try {
      setIsRestoringWorkspace(true);
      await finishWorkspaceBootstrap({
        authUserId: backendAuth.userId,
        name: backendAuth.fullName || 'Owner',
        email: backendAuth.email,
      });
      router.replace('/');
    } catch (err) {
      setError(getAuthErrorMessage(err, 'We could not restore the current session yet.'));
    } finally {
      setIsRestoringWorkspace(false);
      setIsSubmitting(false);
    }
  };

  const handleClearCurrentSession = async () => {
    setError('');
    setNeedsEmailVerification(false);
    setIsClearingSession(true);

    try {
      await authClient.signOut();
    } catch (err) {
      setError(getAuthErrorMessage(err, 'We could not clear the current session just yet.'));
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

          {params.verified ? (
            <View className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <Text className="text-sm font-semibold text-emerald-900 mb-1">
                Email confirmed
              </Text>
              <Text className="text-sm leading-6 text-emerald-800">
                Your account is verified. Sign in to finish opening your workspace.
              </Text>
            </View>
          ) : null}

          {params.checkEmail ? (
            <View className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <Text className="text-sm font-semibold text-sky-900 mb-1">
                Check your inbox
              </Text>
              <Text className="text-sm leading-6 text-sky-800">
                We sent a confirmation email. Open the link there, then return here to sign in.
              </Text>
            </View>
          ) : null}

{null}

          <View className="gap-4 mb-6">
            <Input
              label="Work Email"
              placeholder="you@company.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError('');
                setNeedsEmailVerification(false);
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
                setNeedsEmailVerification(false);
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

{!backendAuth.isSignedIn && needsEmailVerification ? (
            <Button
              title={isResendingVerification ? 'Resending email...' : 'Resend verification email'}
              onPress={handleResendVerification}
              disabled={isResendingVerification}
              variant="outline"
              className="w-full mb-4"
            />
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
