import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '../ui/Badge';
import { isOverdue, dueLabel } from '../../utils/date';
import type { Task, Role } from '../../types';

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  medium: '#d97706',
  low: '#9ca3af',
};

interface TaskTableRowProps {
  task: Task;
  role: Role;
  onPress: () => void;
  isLast?: boolean;
}

export function TaskTableRow({ task, role, onPress, isLast }: TaskTableRowProps) {
  const overdue = isOverdue(task.due, task.status);
  const due = dueLabel(task.due, task.status);

  // Role-contextual secondary info
  let meta = '';
  if (role === 'admin') {
    meta = [task.assignee, task.site].filter(Boolean).join(' · ');
  } else if (role === 'subadmin') {
    meta = task.assignee;
  } else {
    meta = task.site || '';
  }

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-3 py-2.5 active:bg-gray-50 ${
        !isLast ? 'border-b border-gray-100' : ''
      }`}
      style={overdue ? { backgroundColor: '#fef2f2' } : undefined}
    >
      {/* Priority dot */}
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: PRIORITY_COLORS[task.priority] || '#9ca3af',
          marginRight: 8,
        }}
      />

      {/* Title + meta */}
      <View className="flex-1 mr-2">
        <Text className="text-sm text-gray-900" numberOfLines={1}>
          {task.title}
        </Text>
        {meta ? (
          <Text className="text-[10px] text-gray-400 mt-0.5" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>

      {/* Status badge */}
      <View className="mr-2">
        <StatusBadge status={task.status} />
      </View>

      {/* Due */}
      <View style={{ width: 64, alignItems: 'flex-end' }}>
        {due ? (
          <Text
            className={`text-[10px] ${
              due.urgent ? 'text-red-600 font-semibold' : 'text-gray-400'
            }`}
            numberOfLines={1}
          >
            {due.text}
          </Text>
        ) : (
          <Text className="text-[10px] text-gray-300">—</Text>
        )}
      </View>
    </Pressable>
  );
}
