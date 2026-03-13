import { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { useApp } from '../../src/store/AppContext';

export default function OrgNameScreen() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const [name, setName] = useState(state.onboarding.orgName);

  const next = () => {
    if (!name.trim()) return;
    dispatch({ type: 'SET_ORG_NAME', name: name.trim() });
    router.push('/(onboarding)/industry');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 px-6 pt-20 pb-8">
          <View className="flex-1">
            <View className="h-12 w-12 rounded-2xl bg-emerald-600 items-center justify-center mb-8">
              <Ionicons name="home" size={24} color="white" />
            </View>
            <Text className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
              Welcome
            </Text>
            <Text className="text-base text-gray-400 mb-12">
              Let's set up your workspace
            </Text>
            <Text className="text-sm font-medium text-gray-500 mb-2">
              Organization name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Skyhomes Properties"
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
