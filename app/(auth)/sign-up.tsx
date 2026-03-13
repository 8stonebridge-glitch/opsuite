import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { INDUSTRIES } from '../../src/constants/industries';
import { hashPassword, validateEmail, validatePassword } from '../../src/utils/auth';
import type { Industry } from '../../src/types';

export default function SignUpScreen() {
  const { dispatch, findAccountByEmail } = useApp();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [orgStructure, setOrgStructure] = useState<'with_subadmins' | 'admin_only'>('with_subadmins');
  const [error, setError] = useState('');

  const isValid =
    name.trim().length >= 2 &&
    validateEmail(email) &&
    validatePassword(password) &&
    orgName.trim().length >= 2 &&
    industry !== null;

  const handleSignUp = () => {
    setError('');

    if (findAccountByEmail(email.trim())) {
      setError('An account with this email already exists');
      return;
    }

    dispatch({
      type: 'SIGN_UP',
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      orgName: orgName.trim(),
      industry: industry!,
      orgStructure,
    });
    router.replace('/(owner_admin)/overview');
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 mb-6"
          >
            <Ionicons name="arrow-back" size={18} color="#9ca3af" />
            <Text className="text-sm text-gray-400">Back</Text>
          </Pressable>

          {/* Header */}
          <Text className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
            Create account
          </Text>
          <Text className="text-base text-gray-400 mb-8">
            Set up your organization
          </Text>

          {/* Form */}
          <View className="gap-4 mb-6">
            <Input
              label="Full Name"
              placeholder="Your name"
              value={name}
              onChangeText={(t) => { setName(t); setError(''); }}
              autoCapitalize="words"
            />
            <Input
              label="Work Email"
              placeholder="you@company.com"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Password"
              placeholder="Min. 6 characters"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              secureTextEntry
            />
            <Input
              label="Organization Name"
              placeholder="Your company or team"
              value={orgName}
              onChangeText={(t) => { setOrgName(t); setError(''); }}
            />
          </View>

          {/* Industry */}
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

          {/* Org Structure */}
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
            title="Create Account"
            onPress={handleSignUp}
            disabled={!isValid}
          />

          {/* Sign-in link */}
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
