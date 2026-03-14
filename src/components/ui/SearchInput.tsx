import { View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../providers/ThemeProvider';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChangeText, placeholder = 'Search...' }: SearchInputProps) {
  const { isDark } = useTheme();

  return (
    <View className="relative mb-3">
      <View className="absolute left-4 top-3 z-10">
        <Ionicons name="search" size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 pl-11 pr-4 py-3 text-sm text-gray-900 dark:text-gray-100"
      />
    </View>
  );
}
