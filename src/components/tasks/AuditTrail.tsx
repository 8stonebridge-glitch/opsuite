import { View, Text } from 'react-native';
import type { AuditEntry } from '../../types';
import { formatTime } from '../../utils/date';

interface AuditTrailProps {
  entries: AuditEntry[];
}

const TYPE_COLORS: Record<string, string> = {
  Assignment: 'bg-blue-400',
  'Progress Update': 'bg-emerald-400',
  Status: 'bg-blue-400',
  Rejection: 'bg-red-400',
  Rework: 'bg-amber-400',
  Escalation: 'bg-red-500',
  Approval: 'bg-emerald-500',
  Verified: 'bg-emerald-600',
  Note: 'bg-gray-400',
  System: 'bg-gray-300',
  Notification: 'bg-blue-300',
  'No Change': 'bg-gray-300',
  'Check-in': 'bg-emerald-300',
  Instruction: 'bg-purple-400',
  Delegated: 'bg-indigo-400',
  'Daily Handoff': 'bg-emerald-400',
  'No Tasks Today': 'bg-gray-400',
};

export function AuditTrail({ entries }: AuditTrailProps) {
  if (entries.length === 0) {
    return (
      <View className="py-8 items-center">
        <Text className="text-gray-300 text-sm">No activity yet</Text>
      </View>
    );
  }

  return (
    <View className="pl-4">
      {entries.map((entry, i) => {
        const dotColor = TYPE_COLORS[entry.updateType] || 'bg-gray-300';
        const isLast = i === entries.length - 1;

        return (
          <View key={entry.id} className="flex-row">
            <View className="items-center mr-3">
              <View className={`h-2.5 w-2.5 rounded-full mt-1.5 ${dotColor}`} />
              {!isLast && <View className="w-0.5 flex-1 bg-gray-200 mt-1" />}
            </View>
            <View className={`flex-1 ${isLast ? 'pb-2' : 'pb-4'}`}>
              <View className="flex-row items-center gap-2 mb-0.5">
                <Text className="text-xs font-medium text-gray-500">{entry.role}</Text>
                <Text className="text-xs text-gray-300">{entry.dateTag}</Text>
                <Text className="text-xs text-gray-300">{formatTime(entry.createdAt)}</Text>
              </View>
              <Text className="text-sm text-gray-700 leading-5">{entry.message}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
