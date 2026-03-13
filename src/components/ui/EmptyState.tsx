import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = 'folder-open-outline', title, subtitle }: EmptyStateProps) {
  return (
    <View className="py-16 items-center">
      <Ionicons name={icon as any} size={40} color="#d1d5db" />
      <Text className="text-gray-400 text-sm mt-3 font-medium">{title}</Text>
      {subtitle && <Text className="text-gray-300 text-xs mt-1">{subtitle}</Text>}
    </View>
  );
}
