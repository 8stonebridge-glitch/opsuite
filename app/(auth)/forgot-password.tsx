import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useClerk } from '@clerk/expo';
import { useSignIn } from '@clerk/expo/legacy';
import { useApp } from '../../src/store/AppContext';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { getClerkErrorMessage, validateEmail, validatePassword } from '../../src/utils/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { dispatch } = useApp();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const { isLoaded, signIn } = useSignIn();

  const [email, setEmail] = useState('');
  const [emailAddressId, setEmailAddressId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pendingReset, setPendingReset] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isClearingSession, setIsClearingSession] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  const normalizedEmail = email.trim().toLowerCase();

  const handleSendCode = async () => {
    setError('');
    setSuccessMessage('');

    if (isSignedIn) {
      await signOut();
      dispatch({ type: 'SIGN_OUT' });
    }

    if (!validateEmail(email)) {
      setError('Enter a valid work email address.');
      return;
    }

    if (!isLoaded || !signIn) {
      setError('Authentication is still loading. Please try again in a moment.');
      return;
    }

    setIsSendingCode(true);

    try {
      const signInAttempt = await signIn.create({
        identifier: normalizedEmail,
      });

      const resetFactor = signInAttempt.supportedFirstFactors?.find(
        (factor) => factor.strategy === 'reset_password_email_code'
      );

      if (!resetFactor || !('emailAddressId' in resetFactor) || !resetFactor.emailAddressId) {
        throw new Error('Password reset by email is not available for this account.');
      }

      await signIn.prepareFirstFactor({
        strategy: 'reset_password_email_code',
        emailAddressId: resetFactor.emailAddressId,
      });

      setEmailAddressId(resetFactor.emailAddressId);
      setPendingReset(true);
      setSuccessMessage(`We sent a reset code to ${normalizedEmail}.`);
    } catch (err) {
      setError(getClerkErrorMessage(err, 'We could not send a reset code right now.'));
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setSuccessMessage('');

    if (!verificationCode.trim()) {
      setError('Enter the reset code from your email.');
      return;
    }

    if (!validatePassword(newPassword)) {
      setError('Use a new password with at least 6 characters.');
      return;
    }

    if (!isLoaded || !signIn || !emailAddressId) {
      setError('The reset flow is not ready yet. Start again from the email step.');
      return;
    }

    setIsResettingPassword(true);

    try {
      await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: verificationCode.trim(),
        password: newPassword,
      });

      setSuccessMessage('Your password has been updated. You can sign in with the new password now.');
      setTimeout(() => {
        router.replace('/(auth)/sign-in');
      }, 600);
    } catch (err) {
      setError(getClerkErrorMessage(err, 'We could not reset your password.'));
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleRestart = () => {
    setPendingReset(false);
    setEmailAddressId('');
    setVerificationCode('');
    setNewPassword('');
    setSuccessMessage('');
    setError('');
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
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 mb-6"
          >
            <Ionicons name="arrow-back" size={18} color="#9ca3af" />
            <Text className="text-sm text-gray-400">Back</Text>
          </Pressable>

          {!pendingReset ? (
            <>
              <Text className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
                Forgot password
              </Text>
              <Text className="text-base text-gray-400 mb-8">
                We&apos;ll email you a code to reset it
              </Text>

              {isSignedIn ? (
                <View className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <Text className="text-sm font-semibold text-amber-900 mb-1">
                    You’re already signed in
                  </Text>
                  <Text className="text-sm leading-6 text-amber-800">
                    Reset password works best after clearing the current Clerk session on this device.
                  </Text>
                  <View className="mt-4 gap-3">
                    <Button
                      title={isClearingSession ? 'Clearing session...' : 'Sign out current session'}
                      onPress={handleClearCurrentSession}
                      disabled={isClearingSession}
                      className="w-full"
                    />
                    <Button
                      title="Back to sign in"
                      onPress={() => router.replace('/(auth)/sign-in')}
                      variant="outline"
                      className="w-full"
                    />
                  </View>
                </View>
              ) : null}

              <Input
                label="Work Email"
                placeholder="you@company.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                  setSuccessMessage('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                containerClassName="mb-6"
              />

              {error ? (
                <View className="flex-row items-center gap-2 mb-4 px-1">
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text className="text-sm text-red-600">{error}</Text>
                </View>
              ) : null}

              {successMessage ? (
                <View className="flex-row items-center gap-2 mb-4 px-1">
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text className="text-sm text-emerald-700">{successMessage}</Text>
                </View>
              ) : null}

              <Button
                title={isSendingCode ? 'Sending code...' : 'Send reset code'}
                onPress={handleSendCode}
                disabled={isSendingCode}
                className="w-full"
              />
            </>
          ) : (
            <>
              <Text className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
                Reset your password
              </Text>
              <Text className="text-base text-gray-400 mb-8">
                Enter the code from {normalizedEmail}
              </Text>

              <View className="gap-4 mb-6">
                <Input
                  label="Reset Code"
                  placeholder="Enter the code"
                  value={verificationCode}
                  onChangeText={(text) => {
                    setVerificationCode(text);
                    setError('');
                    setSuccessMessage('');
                  }}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input
                  label="New Password"
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    setError('');
                    setSuccessMessage('');
                  }}
                  secureTextEntry
                />
              </View>

              {error ? (
                <View className="flex-row items-center gap-2 mb-4 px-1">
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text className="text-sm text-red-600">{error}</Text>
                </View>
              ) : null}

              {successMessage ? (
                <View className="flex-row items-center gap-2 mb-4 px-1">
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text className="text-sm text-emerald-700">{successMessage}</Text>
                </View>
              ) : null}

              <Button
                title={isResettingPassword ? 'Updating password...' : 'Update password'}
                onPress={handleResetPassword}
                disabled={isResettingPassword}
                className="w-full"
              />

              <Pressable
                onPress={handleRestart}
                className="mt-6 items-center"
              >
                <Text className="text-sm text-gray-400">
                  Need a new code?{' '}
                  <Text className="text-emerald-600 font-semibold">Start again</Text>
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
