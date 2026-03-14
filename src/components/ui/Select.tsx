import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  type ListRenderItemInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../providers/ThemeProvider';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export function Select({ label, placeholder = 'Select', options, value, onChange }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const { isDark } = useTheme();

  const renderItem = ({ item }: ListRenderItemInfo<SelectOption>) => (
    <Pressable
      className={`px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-row items-center justify-between active:bg-gray-50 dark:active:bg-gray-800 ${
        item.value === value ? 'bg-emerald-50 dark:bg-emerald-950' : ''
      }`}
      onPress={() => {
        onChange(item.value);
        setOpen(false);
      }}
    >
      <Text className={`text-base ${item.value === value ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {item.label}
      </Text>
      {item.value === value && (
        <Ionicons name="checkmark" size={20} color={isDark ? '#34d399' : '#059669'} />
      )}
    </Pressable>
  );

  return (
    <View>
      {label && (
        <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
          {label}
        </Text>
      )}
      <Pressable
        className="bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3.5 flex-row items-center justify-between"
        onPress={() => setOpen(true)}
      >
        <Text className={selected ? 'text-base text-gray-900 dark:text-gray-100' : 'text-base text-gray-300 dark:text-gray-600'}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/30 dark:bg-black/50" onPress={() => setOpen(false)} />
        <View className="bg-white dark:bg-gray-900 rounded-t-3xl max-h-[50%]">
          <View className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-row items-center justify-between">
            <Text className="text-base font-bold text-gray-900 dark:text-gray-100">{label || 'Select'}</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Ionicons name="close" size={22} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            renderItem={renderItem}
            keyExtractor={(item) => item.value}
          />
        </View>
      </Modal>
    </View>
  );
}
