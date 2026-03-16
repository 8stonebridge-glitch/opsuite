import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '../ui/Badge';
import { isOverdue, dueLabel } from '../../utils/date';
import { useIndustryColor } from '../../store/selectors';
import { useTheme } from '../../providers/ThemeProvider';
import type { Task, TaskStatus } from '../../types';

const STATUS_COLORS: Record<TaskStatus, string> = {
  'Open': '#6b7280',
  'In Progress': '#3b82f6',
  'Completed': '#059669',
  'Verified': '#9ca3af',
  'Pending Approval': '#d97706',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  medium: '#d97706',
  low: '#9ca3af',
};

interface QuickActions {
  onUpdate: () => void;
  onNoChange: () => void;
  engaged: boolean;
}

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  quickActions?: QuickActions;
  stalledDays?: number;
  assigneeAway?: boolean;
  coverageNeeded?: boolean;
}

export function TaskCard({ task, onPress, quickActions, stalledDays, assigneeAway, coverageNeeded }: TaskCardProps) {
  const overdue = isOverdue(task.due, task.status);
  const industryColor = useIndustryColor();
  const { isDark } = useTheme();
  const borderColor = overdue ? '#dc2626' : STATUS_COLORS[task.status] || industryColor;
  const due = dueLabel(task.due, task.status);

  return (
    <Pressable
      onPress={onPress}
      className={`bg-white dark:bg-gray-900 rounded-2xl mb-2 active:bg-gray-50 dark:active:bg-gray-800 overflow-hidden ${
        overdue ? 'border border-red-100 dark:border-red-900' : 'border border-gray-100 dark:border-gray-800'
      }`}
      style={overdue ? { backgroundColor: isDark ? '#1a0505' : '#fef2f2' } : undefined}
    >
      <View className="flex-row">
        {/* Status color strip */}
        <View style={{ width: 4, backgroundColor: borderColor }} />

        <View className="flex-1 p-4">
          {/* Title row */}
          <View className="flex-row items-center gap-2">
            <View
              style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: PRIORITY_COLORS[task.priority] || '#9ca3af', flexShrink: 0 }}
            />
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1" numberOfLines={1} style={{ minWidth: 0 }}>
              {task.title}
            </Text>
            <StatusBadge status={task.status} />
          </View>
          {/* Badge row — wraps to second line on small screens */}
          {(task.reworked || (stalledDays != null && stalledDays > 0) || coverageNeeded || (assigneeAway && !coverageNeeded)) && (
            <View className="flex-row flex-wrap gap-1.5 mt-1.5 ml-4">
              {task.reworked && (
                <View className="bg-amber-100 dark:bg-amber-950 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">R{task.reworkCount || 1}</Text>
                </View>
              )}
              {stalledDays != null && stalledDays > 0 && (
                <View className="bg-amber-50 dark:bg-amber-950 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Stalled {stalledDays}d</Text>
                </View>
              )}
              {coverageNeeded && (
                <View className="bg-orange-50 dark:bg-orange-950 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">Coverage</Text>
                </View>
              )}
              {assigneeAway && !coverageNeeded && (
                <View className="bg-blue-50 dark:bg-blue-950 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-blue-500 dark:text-blue-400">Away</Text>
                </View>
              )}
            </View>
          )}

          {/* Quick actions for handoff */}
          {quickActions && !quickActions.engaged && (
            <View className="flex-row gap-2 mt-2 ml-4">
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); quickActions.onUpdate(); }}
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 rounded-lg"
              >
                <Text className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Update</Text>
              </Pressable>
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); quickActions.onNoChange(); }}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg"
              >
                <Text className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">No change</Text>
              </Pressable>
            </View>
          )}
          {quickActions?.engaged && (
            <View className="flex-row items-center gap-1 mt-2 ml-4">
              <Ionicons name="checkmark-circle" size={12} color="#059669" />
              <Text className="text-[10px] text-green-600 dark:text-green-400 font-medium">Reviewed</Text>
            </View>
          )}

          {/* Meta row */}
          <View className="flex-row items-center gap-3 mt-2 ml-4 flex-wrap">
            <View className="flex-row items-center gap-1">
              <Ionicons name="person-outline" size={11} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text className="text-xs text-gray-400 dark:text-gray-500">{task.assignee}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={11} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text className="text-xs text-gray-400 dark:text-gray-500">{task.site}</Text>
            </View>
            {due && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="time-outline" size={11} color={due.urgent ? '#dc2626' : isDark ? '#6b7280' : '#9ca3af'} />
                <Text className={`text-xs ${due.urgent ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                  {due.text}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron */}
        <View className="justify-center pr-3">
          <Ionicons name="chevron-forward" size={16} color={isDark ? '#4b5563' : '#d1d5db'} />
        </View>
      </View>
    </Pressable>
  );
}
