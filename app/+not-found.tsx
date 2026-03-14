import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/providers/ThemeProvider';

export default function NotFoundScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center px-6">
      <View className="items-center">
        <Ionicons name="warning-outline" size={48} color={isDark ? '#4b5563' : '#d1d5db'} />
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4">Page not found</Text>
        <Text className="text-base text-gray-400 dark:text-gray-500 mt-2 text-center">
          The page you're looking for doesn't exist or has been moved.
        </Text>
        <Pressable
          onPress={() => router.replace('/')}
          className="mt-6 bg-emerald-600 rounded-2xl px-6 py-3"
        >
          <Text className="text-white font-semibold text-base">Go Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
