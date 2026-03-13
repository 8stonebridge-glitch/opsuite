import { View, Text, TextInput as RNTextInput, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  containerClassName?: string;
}

export function Input({ label, containerClassName = '', className, ...props }: InputProps) {
  return (
    <View className={containerClassName}>
      {label && (
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {label}
        </Text>
      )}
      <RNTextInput
        className={`bg-gray-50 rounded-2xl px-4 py-3.5 text-base text-gray-900 ${className || ''}`}
        placeholderTextColor="#d1d5db"
        {...props}
      />
    </View>
  );
}
