import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { useApp } from '../../src/store/AppContext';
import { uid } from '../../src/utils/id';
import { generateSeedData } from '../../src/store/seed';
import { useTheme } from '../../src/providers/ThemeProvider';

export default function AddSitesScreen() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const { isDark } = useTheme();
  const [siteName, setSiteName] = useState('');

  const sitesLabel = state.onboarding.industry?.sitesLabel || 'Sites';

  const addSite = () => {
    if (!siteName.trim()) return;
    dispatch({ type: 'ADD_SITE', site: { id: uid(), name: siteName.trim() } });
    setSiteName('');
  };

  const finish = () => {
    dispatch({ type: 'FINISH_ONBOARDING' });

    // Seed demo data
    const indId = state.onboarding.industry?.id || '';
    const seed = generateSeedData(indId, state.onboarding.sites, state.onboarding.adminName || 'Admin');
    dispatch({ type: 'SET_TASKS', tasks: seed.tasks });
    dispatch({ type: 'SET_AUDIT', entries: seed.audit });
    dispatch({ type: 'SET_CHECKINS', checkIns: seed.checkIns });

    router.replace('/');
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
            <Text className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
              Add {sitesLabel.toLowerCase()}
            </Text>
            <Text className="text-base text-gray-400 dark:text-gray-500 mb-8">
              Where does your team work?
            </Text>

            <View className="flex-row gap-3 mb-5">
              <TextInput
                value={siteName}
                onChangeText={setSiteName}
                onSubmitEditing={addSite}
                placeholder="Main Office"
                placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
                className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100"
              />
              <Pressable
                onPress={addSite}
                disabled={!siteName.trim()}
                className={`px-5 rounded-2xl items-center justify-center ${
                  !siteName.trim() ? 'opacity-20' : ''
                }`}
                style={{ backgroundColor: '#059669' }}
              >
                <Text className="text-white font-medium">Add</Text>
              </Pressable>
            </View>

            <View className="gap-2">
              {state.onboarding.sites.map((s) => (
                <View
                  key={s.id}
                  className="flex-row items-center justify-between py-3.5 px-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
                >
                  <Text className="text-base font-medium text-gray-900 dark:text-gray-100">{s.name}</Text>
                  <Pressable onPress={() => dispatch({ type: 'REMOVE_SITE', siteId: s.id })}>
                    <Ionicons name="close" size={16} color="#d1d5db" />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <Button
            title={state.onboarding.sites.length > 0
              ? `Launch ${state.onboarding.orgName}`
              : 'Skip for now'}
            onPress={finish}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
