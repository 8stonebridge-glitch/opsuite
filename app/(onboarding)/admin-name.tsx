import { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { useApp } from '../../src/store/AppContext';

export default function AdminNameScreen() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const [name, setName] = useState(state.onboarding.adminName);

  const next = () => {
    if (!name.trim()) return;
    dispatch({ type: 'SET_ADMIN_NAME', name: name.trim() });
    router.push('/(onboarding)/add-sites');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 px-6 pt-12 pb-8">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 mb-6"
          >
            <Ionicons name="arrow-back" size={18} color="#9ca3af" />
            <Text className="text-sm text-gray-400">Back</Text>
          </Pressable>

          <View className="flex-1">
            <Text className="text-3xl font-bold tracking-tight text-gray-900 mb-12">
              Your name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Sunday Agwaze"
              placeholderTextColor="#d1d5db"
              autoFocus
              onSubmitEditing={next}
              className="text-xl bg-white border border-gray-200 rounded-2xl px-5 py-4 text-gray-900"
            />
          </View>
          <Button title="Continue" onPress={next} disabled={!name.trim()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
