import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AvailabilityRecord, AvailabilityType, AvailabilityStatus } from '../../types';
import { Card } from '../ui/Card';
import { useTheme } from '../../providers/ThemeProvider';

const TYPE_CONFIG: Record<AvailabilityType, { icon: string; label: string; color: string }> = {
  leave: { icon: 'airplane', label: 'Leave', color: '#3b82f6' },
  sick: { icon: 'medkit', label: 'Sick', color: '#ef4444' },
  off_duty: { icon: 'moon', label: 'Off Duty', color: '#6366f1' },
};

const STATUS_CONFIG: Record<AvailabilityStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: '#fef3c7', text: '#d97706' },
  approved: { label: 'Approved', bg: '#d1fae5', text: '#059669' },
  rejected: { label: 'Rejected', bg: '#fee2e2', text: '#dc2626' },
  cancelled: { label: 'Cancelled', bg: '#f3f4f6', text: '#6b7280' },
};

interface AvailabilityHistoryProps {
  records: AvailabilityRecord[];
}

export function AvailabilityHistory({ records }: AvailabilityHistoryProps) {
  const { isDark } = useTheme();
  const sorted = [...records].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (sorted.length === 0) {
    return (
      <View className="items-center py-8">
        <Ionicons name="calendar-outline" size={36} color={isDark ? '#6b7280' : '#d1d5db'} />
        <Text className="text-sm text-gray-400 dark:text-gray-500 mt-2">No availability records</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {sorted.map((record) => {
        const typeConfig = TYPE_CONFIG[record.type];
        const statusConfig = STATUS_CONFIG[record.status];
        const dateRange =
          record.startDate === record.endDate
            ? formatShortDate(record.startDate)
            : `${formatShortDate(record.startDate)} - ${formatShortDate(record.endDate)}`;

        return (
          <View
            key={record.id}
            className="flex-row items-center gap-3 py-3 border-b border-gray-50 dark:border-gray-800"
          >
            <View
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: typeConfig.color + '15' }}
            >
              <Ionicons name={typeConfig.icon as any} size={16} color={typeConfig.color} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{typeConfig.label}</Text>
              <Text className="text-xs text-gray-400 dark:text-gray-500">{dateRange}</Text>
            </View>
            <View
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: statusConfig.bg }}
            >
              <Text
                className="text-[10px] font-semibold"
                style={{ color: statusConfig.text }}
              >
                {statusConfig.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
