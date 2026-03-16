import { type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../providers/ThemeProvider';

export interface StatPill {
  label: string;
  value: number | string;
  color: string;
}

interface HealthCardProps {
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  stats: StatPill[];
  onPress?: () => void;
  rightContent?: ReactNode;
}

export function HealthCard({ title, subtitle, icon, iconColor, stats, onPress, rightContent }: HealthCardProps) {
  const { isDark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
    >
      <View className="flex-row items-center gap-3 mb-3">
        {icon && (
          <View
            className="w-9 h-9 rounded-xl items-center justify-center"
            style={{ backgroundColor: (iconColor || '#059669') + '15', flexShrink: 0 }}
          >
            <Ionicons name={icon as any} size={18} color={iconColor || '#059669'} />
          </View>
        )}
        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100" numberOfLines={1}>{title}</Text>
          {subtitle && <Text className="text-xs text-gray-400 dark:text-gray-500" numberOfLines={1}>{subtitle}</Text>}
        </View>
        {rightContent}
        {onPress && <Ionicons name="chevron-forward" size={16} color={isDark ? '#4b5563' : '#d1d5db'} />}
      </View>

      <View className="flex-row gap-2">
        {stats.map((stat, i) => (
          <View
            key={i}
            className="flex-1 rounded-xl py-2 px-1 items-center"
            style={{ backgroundColor: stat.color + (isDark ? '20' : '10'), minWidth: 0 }}
          >
            <Text className="text-base font-bold" numberOfLines={1} style={{ color: stat.color }}>
              {stat.value}
            </Text>
            <Text className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-0.5" numberOfLines={1}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
