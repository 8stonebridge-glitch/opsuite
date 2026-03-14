import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { INDUSTRIES } from '../../src/constants/industries';
import { getAuthErrorMessage, validateEmail, validatePassword } from '../../src/utils/auth';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { authClient, emailVerificationCallbackUrl } from '../../src/lib/auth-client';
import type { Industry } from '../../src/types';

export default function SignUpScreen() {
  const router = useRouter();
  const { dispatch } = useApp();
  const { isSignedIn } = useBackendAuth();
  const storeSignupDraft = useMutation(api.organizations.storeSignupDraft);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [orgStructure, setOrgStructure] = useState<'with_subadmins' | 'admin_only'>('with_subadmins');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearingSession, setIsClearingSession] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) {
      return;
    }

    setError('');
    setIsResendingVerification(true);

    try {
      const result = await authClient.sendVerificationEmail({
        email: pendingVerificationEmail,
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

    if (password !== confirmPassword) {
      setError('Passwords must match exactly.');
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

    setIsSubmitting(true);

    try {
      if (isSignedIn) {
        await authClient.signOut();
        dispatch({ type: 'SIGN_OUT' });
      }

      const result = await authClient.signUp.email({
        name: name.trim(),
        email: normalizedEmail,
        password,
        callbackURL: emailVerificationCallbackUrl,
      });

      if (result.error) {
        throw new Error(result.error.message || 'We could not create your account just yet.');
      }

      await storeSignupDraft({
        email: normalizedEmail,
        organizationName: orgName.trim(),
        industryId: industry.id,
        mode: orgStructure === 'with_subadmins' ? 'managed' : 'direct',
      });
      setPendingVerificationEmail(normalizedEmail);
    } catch (err) {
      setError(getAuthErrorMessage(err, 'We could not create your account just yet.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearCurrentSession = async () => {
    setError('');
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

          <Text className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
            Create account
          </Text>
          <Text className="text-base text-gray-400 mb-8">
            Set up your organization
          </Text>

          {pendingVerificationEmail ? (
            <View className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <View className="h-12 w-12 rounded-2xl bg-emerald-100 items-center justify-center mb-4">
                <Ionicons name="mail-open-outline" size={24} color="#059669" />
              </View>
              <Text className="text-xl font-semibold text-gray-900 mb-2">
                Check your email
              </Text>
              <Text className="text-sm leading-6 text-gray-600 mb-5">
                We sent a confirmation link to {pendingVerificationEmail}. Once you verify it, your workspace draft will finish setting up the next time you open the app.
              </Text>

              {error ? (
                <View className="flex-row items-center gap-2 mb-4">
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text className="text-sm text-red-600 flex-1">{error}</Text>
                </View>
              ) : null}

              <View className="gap-3">
                <Button
                  title={isResendingVerification ? 'Resending email...' : 'Resend verification email'}
                  onPress={handleResendVerification}
                  disabled={isResendingVerification}
                  className="w-full"
                />
                <Button
                  title="Back to sign in"
                  onPress={() => router.replace('/(auth)/sign-in?checkEmail=1')}
                  variant="outline"
                  className="w-full"
                />
              </View>
            </View>
          ) : null}

          {!pendingVerificationEmail && isSignedIn ? (
            <View className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <Text className="text-sm font-semibold text-amber-900 mb-1">
                You’re already signed in
              </Text>
              <Text className="text-sm leading-6 text-amber-800">
                To create a different owner account, clear the current session first. If this is already your account, head back to sign in and continue that session instead.
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

          {!pendingVerificationEmail ? (
            <>
              <View className="gap-4 mb-6">
            <Input
              label="Full Name"
              placeholder="Your name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError('');
              }}
              autoCapitalize="words"
            />
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
              placeholder="Min. 6 characters"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError('');
              }}
              secureTextEntry
            />
            <Input
              label="Confirm Password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setError('');
              }}
              secureTextEntry
            />
            <Input
              label="Organization Name"
              placeholder="Your company or team"
              value={orgName}
              onChangeText={(text) => {
                setOrgName(text);
                setError('');
              }}
            />
              </View>

              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Industry
              </Text>
              <View className="flex-row flex-wrap gap-3 mb-6">
                {INDUSTRIES.map((ind) => {
                  const selected = industry?.id === ind.id;
                  return (
                    <Pressable
                      key={ind.id}
                      onPress={() => setIndustry(ind)}
                      className={`w-[48%] p-4 rounded-2xl border-2 ${
                        selected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <View
                        className="h-8 w-8 rounded-xl mb-3 items-center justify-center"
                        style={{ backgroundColor: `${ind.color}18` }}
                      >
                        <View
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: ind.color }}
                        />
                      </View>
                      <Text className="text-sm font-semibold text-gray-900">
                        {ind.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Organization Structure
              </Text>
              <View className="flex-row gap-3 mb-8">
                <Pressable
                  onPress={() => setOrgStructure('with_subadmins')}
                  className={`flex-1 p-4 rounded-2xl border-2 ${
                    orgStructure === 'with_subadmins'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <Ionicons
                    name="git-branch-outline"
                    size={22}
                    color={orgStructure === 'with_subadmins' ? '#059669' : '#9ca3af'}
                  />
                  <Text className="text-sm font-semibold text-gray-900 mt-2">
                    With SubAdmins
                  </Text>
                  <Text className="text-xs text-gray-400 mt-1">
                    Admin → Leads → Staff
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setOrgStructure('admin_only')}
                  className={`flex-1 p-4 rounded-2xl border-2 ${
                    orgStructure === 'admin_only'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <Ionicons
                    name="person-outline"
                    size={22}
                    color={orgStructure === 'admin_only' ? '#059669' : '#9ca3af'}
                  />
                  <Text className="text-sm font-semibold text-gray-900 mt-2">
                    Admin Only
                  </Text>
                  <Text className="text-xs text-gray-400 mt-1">
                    Admin → Staff
                  </Text>
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
                disabled={isSubmitting}
                className="w-full"
              />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
