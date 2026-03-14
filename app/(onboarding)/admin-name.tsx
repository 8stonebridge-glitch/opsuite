import { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { useApp } from '../../src/store/AppContext';
import { useTheme } from '../../src/providers/ThemeProvider';

export default function AdminNameScreen() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const { isDark } = useTheme();
  const [name, setName] = useState(state.onboarding.adminName);

  const next = () => {
    if (!name.trim()) return;
    dispatch({ type: 'SET_ADMIN_NAME', name: name.trim() });
    router.push('/(onboarding)/add-sites');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 px-6 pt-12 pb-8">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 mb-6"
          >
            <Ionicons name="arrow-back" size={18} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text className="text-sm text-gray-400 dark:text-gray-500">Back</Text>
          </Pressable>

          <View className="flex-1">
            <Text className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-12">
              Your name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Sunday Agwaze"
              placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
              autoFocus
              onSubmitEditing={next}
              className="text-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-gray-900 dark:text-gray-100"
            />
          </View>
          <Button title="Continue" onPress={next} disabled={!name.trim()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
