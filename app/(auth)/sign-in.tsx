import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { hashPassword, validateEmail } from '../../src/utils/auth';

export default function SignInScreen() {
  const { dispatch, findAccountByEmail } = useApp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const isValid = validateEmail(email) && password.length >= 1;

  const handleSignIn = () => {
    setError('');
    const account = findAccountByEmail(email.trim());
    if (!account) {
      setError('No account found with this email');
      return;
    }
    if (account.passwordHash !== hashPassword(password)) {
      setError('Incorrect password');
      return;
    }
    dispatch({ type: 'SIGN_IN', accountId: account.id });
    router.replace('/');
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
          keyboardShouldPersistTaps="handled"
        >
          {/* Branding */}
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

          {/* Form */}
          <View className="gap-4 mb-6">
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
              placeholder="Enter password"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              secureTextEntry
            />
          </View>

          {error ? (
            <View className="flex-row items-center gap-2 mb-4 px-1">
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text className="text-sm text-red-600">{error}</Text>
            </View>
          ) : null}

          <Button
            title="Sign In"
            onPress={handleSignIn}
            disabled={!isValid}
          />

          {/* Sign-up link */}
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            className="mt-6 items-center"
          >
            <Text className="text-sm text-gray-400">
              Don't have an account?{' '}
              <Text className="text-emerald-600 font-semibold">Sign Up</Text>
            </Text>
          </Pressable>

          {/* Demo hint */}
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
