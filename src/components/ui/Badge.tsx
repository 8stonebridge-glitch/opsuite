import { View, Text } from 'react-native';
import type { TaskStatus } from '../../types';
import { STATUS_COLORS, STATUS_SHORT } from '../../constants/statuses';

interface BadgeProps {
  status: TaskStatus;
}

export function StatusBadge({ status }: BadgeProps) {
  const colors = STATUS_COLORS[status] || { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' };
  const label = STATUS_SHORT[status] || status;

  return (
    <View className={`rounded-full px-2.5 py-0.5 ${colors.bg}`}>
      <Text className={`text-xs font-medium ${colors.text}`}>{label}</Text>
    </View>
  );
}

interface PriorityBadgeProps {
  priority: string;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    critical: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-600 dark:text-red-400', label: 'High' },
    medium: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', label: 'Medium' },
    low: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', label: 'Low' },
  };
  const cfg = map[priority] || map.medium;

  return (
    <View className={`rounded-full px-2.5 py-0.5 ${cfg.bg}`}>
      <Text className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</Text>
    </View>
  );
}
