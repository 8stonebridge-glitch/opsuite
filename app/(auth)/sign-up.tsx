import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSignUp } from '../../src/lib/clerk';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { INDUSTRIES } from '../../src/constants/industries';
import { getAuthErrorMessage, validateEmail, validatePassword } from '../../src/utils/auth';
import { withTimeout } from '../../src/utils/promise';
import { useTheme } from '../../src/providers/ThemeProvider';
import type { Industry } from '../../src/types';

export default function SignUpScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { signUp, setActive, isLoaded: clerkLoaded } = useSignUp();
  const storeSignupDraft = useMutation(api.organizations.storeSignupDraft);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [orgStructure, setOrgStructure] = useState<'with_subadmins' | 'admin_only'>('with_subadmins');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const hasConfirmPassword = confirmPassword.length > 0;
  const passwordsMatch = password === confirmPassword;
  const passwordMismatchMessage =
    hasConfirmPassword && !passwordsMatch ? 'Confirm password must match your password.' : '';

  const handleCreateAccount = async () => {
    setError('');

    if (name.trim().length < 2) {
      setError('Enter your full name to continue.');
      return;
    }
    if (!validateEmail(email)) {
      setError('Enter a valid work email address.');
      return;
    }
    if (!validatePassword(password)) {
      setError('Use a password with at least 6 characters.');
      return;
    }
    if (!passwordsMatch) {
      setError('Confirm password must match your password.');
      return;
    }
    if (orgName.trim().length < 2) {
      setError('Enter your organization name to continue.');
      return;
    }
    if (!industry) {
      setError('Choose an industry before continuing.');
      return;
    }

    if (!clerkLoaded || !signUp) {
      setError('Auth is still loading. Please wait.');
      return;
    }

    setIsSubmitting(true);

    try {
      const nameParts = name.trim().split(/\s+/);
      await withTimeout(
        signUp.create({
          emailAddress: normalizedEmail,
          password,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || undefined,
        }),
        12000,
        'Sign up timed out — security check may have failed. Please refresh and try again.',
      );

      // Run email verification prep and signup draft storage in parallel
      await Promise.all([
        signUp.prepareEmailAddressVerification({ strategy: 'email_code' }),
        storeSignupDraft({
          email: normalizedEmail,
          organizationName: orgName.trim(),
          industryId: industry.id,
          mode: orgStructure === 'with_subadmins' ? 'managed' : 'direct',
        }),
      ]);

      setPendingVerification(true);
    } catch (err: any) {
      const clerkErrors = err?.errors;
      if (Array.isArray(clerkErrors) && clerkErrors.length > 0) {
        setError(clerkErrors[0].longMessage || clerkErrors[0].message || 'We could not create your account.');
      } else {
        setError(getAuthErrorMessage(err, 'We could not create your account just yet.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!clerkLoaded || !signUp) return;

    setError('');
    setIsSubmitting(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        // Go to index — SessionBridge will sync user + claim signup draft,
        // then redirect to the correct dashboard once authenticated.
        router.replace('/');
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      const clerkErrors = err?.errors;
      if (Array.isArray(clerkErrors) && clerkErrors.length > 0) {
        setError(clerkErrors[0].longMessage || clerkErrors[0].message || 'Invalid code.');
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
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
            Create account
          </Text>
          <Text className="text-base text-gray-400 dark:text-gray-500 mb-8">
            Set up your organization
          </Text>

          {pendingVerification ? (
            <View className="rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-5">
              <View className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900 items-center justify-center mb-4">
                <Ionicons name="mail-open-outline" size={24} color="#059669" />
              </View>
              <Text className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Verify your email
              </Text>
              <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400 mb-5">
                We sent a 6-digit code to {normalizedEmail}. Enter it below to verify your account.
              </Text>

              <Input
                label="Verification Code"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChangeText={(text) => {
                  setVerificationCode(text);
                  setError('');
                }}
                keyboardType="number-pad"
              />

              {error ? (
                <View className="flex-row items-center gap-2 mt-4">
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</Text>
                </View>
              ) : null}

              <View className="gap-3 mt-4">
                <Button
                  title={isSubmitting ? 'Verifying...' : 'Verify Email'}
                  onPress={handleVerify}
                  disabled={isSubmitting || verificationCode.length < 6}
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
          ) : (
            <>
              <View className="gap-4 mb-6">
                <Input
                  label="Full Name"
                  placeholder="Your name"
                  value={name}
                  onChangeText={(text) => { setName(text); setError(''); }}
                  autoCapitalize="words"
                />
                <Input
                  label="Work Email"
                  placeholder="you@company.com"
                  value={email}
                  onChangeText={(text) => { setEmail(text); setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input
                  label="Password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChangeText={(text) => { setPassword(text); setError(''); }}
                  className={passwordMismatchMessage ? 'border border-red-300 bg-red-50' : ''}
                  secureTextEntry
                />
                <Input
                  label="Confirm Password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChangeText={(text) => { setConfirmPassword(text); setError(''); }}
                  className={passwordMismatchMessage ? 'border border-red-300 bg-red-50' : ''}
                  secureTextEntry
                />
                {passwordMismatchMessage ? (
                  <View className="flex-row items-center gap-2 px-1 -mt-2">
                    <Ionicons name="alert-circle" size={16} color="#dc2626" />
                    <Text className="text-sm text-red-600 flex-1">{passwordMismatchMessage}</Text>
                  </View>
                ) : null}
                <Input
                  label="Organization Name"
                  placeholder="Your company or team"
                  value={orgName}
                  onChangeText={(text) => { setOrgName(text); setError(''); }}
                />
              </View>

              <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Industry
              </Text>
              <View className="flex-row flex-wrap gap-3 mb-6">
                {INDUSTRIES.map((ind) => {
                  const selected = industry?.id === ind.id;
                  return (
                    <Pressable
                      key={ind.id}
                      onPress={() => setIndustry(ind)}
                      className={`w-[47%] p-4 rounded-2xl border-2 ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                      }`}
                    >
                      <View
                        className="h-8 w-8 rounded-xl mb-2 items-center justify-center"
                        style={{ backgroundColor: `${ind.color}18` }}
                      >
                        <View className="h-3 w-3 rounded-full" style={{ backgroundColor: ind.color }} />
                      </View>
                      <Text
                        className={`text-sm font-semibold ${
                          selected
                            ? 'text-emerald-800 dark:text-emerald-200'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                        numberOfLines={2}
                      >
                        {ind.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Organization Structure
              </Text>
              <View className="flex-row gap-3 mb-8">
                <Pressable
                  onPress={() => setOrgStructure('with_subadmins')}
                  className={`flex-1 p-4 rounded-2xl border-2 ${
                    orgStructure === 'with_subadmins'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                  }`}
                >
                  <Ionicons
                    name="git-branch-outline"
                    size={22}
                    color={orgStructure === 'with_subadmins' ? '#059669' : isDark ? '#6b7280' : '#9ca3af'}
                  />
                  <Text className={`text-sm font-semibold mt-2 ${orgStructure === 'with_subadmins' ? 'text-emerald-800 dark:text-emerald-200' : 'text-gray-900 dark:text-gray-100'}`}>With SubAdmins</Text>
                  <Text className={`text-xs mt-1 ${orgStructure === 'with_subadmins' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>Admin → Leads → Staff</Text>
                </Pressable>
                <Pressable
                  onPress={() => setOrgStructure('admin_only')}
                  className={`flex-1 p-4 rounded-2xl border-2 ${
                    orgStructure === 'admin_only'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                  }`}
                >
                  <Ionicons
                    name="person-outline"
                    size={22}
                    color={orgStructure === 'admin_only' ? '#059669' : isDark ? '#6b7280' : '#9ca3af'}
                  />
                  <Text className={`text-sm font-semibold mt-2 ${orgStructure === 'admin_only' ? 'text-emerald-800 dark:text-emerald-200' : 'text-gray-900 dark:text-gray-100'}`}>Admin Only</Text>
                  <Text className={`text-xs mt-1 ${orgStructure === 'admin_only' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>Admin → Staff</Text>
                </Pressable>
              </View>

              {error ? (
                <View className="flex-row items-center gap-2 mb-4 px-1">
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text className="text-sm text-red-600 flex-1">{error}</Text>
                </View>
              ) : null}

              <Button
                title={isSubmitting ? 'Creating account...' : 'Create Account'}
                onPress={handleCreateAccount}
                disabled={isSubmitting || Boolean(passwordMismatchMessage)}
                className="w-full"
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
