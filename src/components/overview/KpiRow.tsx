import { View, Text, Pressable } from 'react-native';

export interface KpiItem {
  label: string;
  value: number;
  color: string;
  onPress?: () => void;
}

interface KpiRowProps {
  items: KpiItem[];
}

export function KpiRow({ items }: KpiRowProps) {
  return (
    <View className="flex-row gap-2">
      {items.map((kpi, i) => (
        <Pressable
          key={i}
          onPress={kpi.onPress}
          className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 items-center border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
        >
          <Text className="text-2xl font-bold" style={{ color: kpi.color }}>
            {kpi.value}
          </Text>
          <Text className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wider">
            {kpi.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
