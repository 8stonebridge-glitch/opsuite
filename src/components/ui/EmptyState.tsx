import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../providers/ThemeProvider';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = 'folder-open-outline', title, subtitle }: EmptyStateProps) {
  const { isDark } = useTheme();

  return (
    <View className="py-16 items-center">
      <Ionicons name={icon as any} size={40} color={isDark ? '#4b5563' : '#d1d5db'} />
      <Text className="text-gray-400 dark:text-gray-500 text-sm mt-3 font-medium">{title}</Text>
      {subtitle && <Text className="text-gray-300 dark:text-gray-600 text-xs mt-1">{subtitle}</Text>}
    </View>
  );
}
