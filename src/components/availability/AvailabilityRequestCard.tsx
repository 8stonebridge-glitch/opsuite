import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AvailabilityRecord, AvailabilityType } from '../../types';
import { useApp } from '../../store/AppContext';
import { useAllEmployees } from '../../store/selectors';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';

const TYPE_CONFIG: Record<AvailabilityType, { icon: string; label: string; color: string }> = {
  leave: { icon: 'airplane', label: 'Leave', color: '#3b82f6' },
  sick: { icon: 'medkit', label: 'Sick', color: '#ef4444' },
  off_duty: { icon: 'moon', label: 'Off Duty', color: '#6366f1' },
};

interface AvailabilityRequestCardProps {
  record: AvailabilityRecord;
  approverId: string;
}

export function AvailabilityRequestCard({ record, approverId }: AvailabilityRequestCardProps) {
  const { dispatch } = useApp();
  const allEmployees = useAllEmployees();
  const employee = allEmployees.find((e) => e.id === record.memberId);
  const typeConfig = TYPE_CONFIG[record.type];

  const dateRange =
    record.startDate === record.endDate
      ? formatShortDate(record.startDate)
      : `${formatShortDate(record.startDate)} - ${formatShortDate(record.endDate)}`;

  const handleApprove = () => {
    dispatch({
      type: 'APPROVE_AVAILABILITY',
      recordId: record.id,
      approvedById: approverId,
    });
  };

  const handleReject = () => {
    dispatch({
      type: 'REJECT_AVAILABILITY',
      recordId: record.id,
      approvedById: approverId,
    });
  };

  return (
    <Card>
      <View className="flex-row items-center gap-3 mb-3">
        <Avatar name={employee?.name || 'Unknown'} color={typeConfig.color} size="sm" />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900">
            {employee?.name || 'Unknown'}
          </Text>
          <Text className="text-xs text-gray-400">
            {employee?.teamName || 'Team'}
          </Text>
        </View>
        <View
          className="px-2.5 py-1 rounded-full flex-row items-center gap-1"
          style={{ backgroundColor: typeConfig.color + '15' }}
        >
          <Ionicons name={typeConfig.icon as any} size={12} color={typeConfig.color} />
          <Text
            className="text-[10px] font-semibold"
            style={{ color: typeConfig.color }}
          >
            {typeConfig.label}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 mb-2">
        <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
        <Text className="text-xs text-gray-500">{dateRange}</Text>
      </View>

      {record.notes ? (
        <Text className="text-xs text-gray-400 mb-3" numberOfLines={2}>
          {record.notes}
        </Text>
      ) : null}

      <View className="flex-row gap-2">
        <Pressable
          onPress={handleApprove}
          className="flex-1 py-2.5 rounded-xl items-center bg-green-50"
        >
          <Text className="text-xs font-semibold text-green-600">Approve</Text>
        </Pressable>
        <Pressable
          onPress={handleReject}
          className="flex-1 py-2.5 rounded-xl items-center bg-red-50"
        >
          <Text className="text-xs font-semibold text-red-500">Reject</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
