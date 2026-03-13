import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSignUp } from '@clerk/expo/legacy';
import { useConvex, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { INDUSTRIES } from '../../src/constants/industries';
import { getClerkErrorMessage, splitName, validateEmail, validatePassword } from '../../src/utils/auth';
import { waitForConvexIdentity } from '../../src/utils/backendSync';
import { useOwnerSessionBootstrap } from '../../src/hooks/useOwnerSessionBootstrap';
import type { Industry } from '../../src/types';

export default function SignUpScreen() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const convex = useConvex();
  const syncFromClerk = useMutation(api.users.syncFromClerk);
  const createOrganization = useMutation(api.organizations.create);
  const bootstrapOwnerSession = useOwnerSessionBootstrap();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [orgStructure, setOrgStructure] = useState<'with_subadmins' | 'admin_only'>('with_subadmins');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const handleCreateAccount = async () => {
    if (!isLoaded || !signUp) return;

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
      const { firstName, lastName } = splitName(name);

      await signUp.create({
        emailAddress: normalizedEmail,
        password,
        firstName,
        lastName,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err) {
      setError(getClerkErrorMessage(err, 'We could not create your account just yet.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!isLoaded || !signUp || !setActive || !industry) return;

    setError('');
    setIsVerifying(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (result.status !== 'complete' || !result.createdSessionId) {
        throw new Error('That code is not complete yet. Please check the latest code in your inbox.');
      }

      const clerkUserId = result.createdUserId || signUp.createdUserId;
      if (!clerkUserId) {
        throw new Error('Your account was created, but we could not finish sign-in. Please try again.');
      }

      await setActive({ session: result.createdSessionId });
      await waitForConvexIdentity(convex);
      await syncFromClerk({});
      await createOrganization({
        name: orgName.trim(),
        industryId: industry.id,
        mode: orgStructure === 'with_subadmins' ? 'managed' : 'direct',
      });
      await bootstrapOwnerSession({
        clerkUserId,
        name: name.trim(),
        email: normalizedEmail,
      });
      router.replace('/');
    } catch (err) {
      setError(getClerkErrorMessage(err, 'We could not verify that email code.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || !signUp) return;

    setError('');
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setError(getClerkErrorMessage(err, 'We could not resend the code right now.'));
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

          {!pendingVerification ? (
            <>
              <Text className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
                Create account
              </Text>
              <Text className="text-base text-gray-400 mb-8">
                Set up your organization
              </Text>

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
                  <Text className="text-sm text-red-600">{error}</Text>
                </View>
              ) : null}

              <Button
                title={isSubmitting ? 'Sending code...' : 'Create Account'}
                onPress={handleCreateAccount}
                disabled={isSubmitting}
                className="w-full"
              />
            </>
          ) : (
            <>
              <Text className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
                Verify your email
              </Text>
              <Text className="text-base text-gray-400 mb-8">
                We sent a code to {normalizedEmail}
              </Text>

              <View className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6">
                <Text className="text-sm text-emerald-700 leading-6">
                  New accounts must verify before we open the workspace. Enter the latest code from your inbox, then we’ll finish creating your organization.
                </Text>
              </View>

              <Input
                label="Verification Code"
                placeholder="Enter the code"
                value={verificationCode}
                onChangeText={(text) => {
                  setVerificationCode(text);
                  setError('');
                }}
                keyboardType="number-pad"
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

              <Button
                title={isVerifying ? 'Verifying...' : 'Verify Email'}
                onPress={handleVerifyEmail}
                disabled={verificationCode.trim().length < 4 || isVerifying}
                className="w-full"
              />

              <Pressable
                onPress={handleResendCode}
                className="mt-4 items-center"
              >
                <Text className="text-sm text-emerald-600 font-semibold">
                  Resend code
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setPendingVerification(false);
                  setVerificationCode('');
                  setError('');
                }}
                className="mt-4 items-center"
              >
                <Text className="text-sm text-gray-400">
                  Edit details
                </Text>
              </Pressable>
            </>
          )}

          <Pressable
            onPress={() => router.back()}
            className="mt-6 items-center"
          >
            <Text className="text-sm text-gray-400">
              Already have an account?{' '}
              <Text className="text-emerald-600 font-semibold">Sign In</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
