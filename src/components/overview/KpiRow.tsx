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
  const isCompact = items.length > 4;
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((kpi, i) => (
        <Pressable
          key={i}
          onPress={kpi.onPress}
          className={`bg-white dark:bg-gray-900 rounded-2xl ${isCompact ? 'p-3' : 'p-4'} items-center border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800`}
          style={{ flexGrow: 1, flexBasis: isCompact ? '18%' : '22%', minWidth: 60 }}
        >
          <Text className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold`} style={{ color: kpi.color }}>
            {kpi.value}
          </Text>
          <Text className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wider" numberOfLines={1}>
            {kpi.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
