import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { INDUSTRIES } from '../../src/constants/industries';
import { useApp } from '../../src/store/AppContext';
import { useTheme } from '../../src/providers/ThemeProvider';

export default function IndustryScreen() {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const { isDark } = useTheme();

  const select = (ind: (typeof INDUSTRIES)[0]) => {
    dispatch({ type: 'SET_INDUSTRY', industry: ind });
    router.push('/(onboarding)/admin-name');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="flex-1 px-6 pt-12 pb-8">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1 mb-6"
        >
          <Ionicons name="arrow-back" size={18} color={isDark ? '#6b7280' : '#9ca3af'} />
          <Text className="text-sm text-gray-400 dark:text-gray-500">Back</Text>
        </Pressable>

        <Text className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
          Your industry
        </Text>
        <Text className="text-base text-gray-400 dark:text-gray-500 mb-8">
          This loads the right categories
        </Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="flex-row flex-wrap gap-3">
            {INDUSTRIES.map((ind) => (
              <Pressable
                key={ind.id}
                onPress={() => select(ind)}
                className={`w-[48%] p-4 rounded-2xl border-2 ${
                  state.onboarding.industry?.id === ind.id
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
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
                <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {ind.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
