import { View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChangeText, placeholder = 'Search...' }: SearchInputProps) {
  return (
    <View className="relative mb-3">
      <View className="absolute left-4 top-3 z-10">
        <Ionicons name="search" size={16} color="#9ca3af" />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#d1d5db"
        className="bg-white rounded-2xl border border-gray-200 pl-11 pr-4 py-3 text-sm text-gray-900"
      />
    </View>
  );
}
