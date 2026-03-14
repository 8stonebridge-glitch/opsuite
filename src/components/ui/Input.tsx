import { View, Text, TextInput as RNTextInput, type TextInputProps } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider';

interface InputProps extends TextInputProps {
  label?: string;
  containerClassName?: string;
}

export function Input({ label, containerClassName = '', className, ...props }: InputProps) {
  const { isDark } = useTheme();

  return (
    <View className={containerClassName}>
      {label && (
        <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
          {label}
        </Text>
      )}
      <RNTextInput
        className={`bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 ${className || ''}`}
        placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
        {...props}
      />
    </View>
  );
}
