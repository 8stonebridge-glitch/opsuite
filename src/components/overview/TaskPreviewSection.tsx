import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TaskCard } from '../tasks/TaskCard';
import type { Task } from '../../types';

interface TaskPreviewSectionProps {
  title: string;
  tasks: Task[];
  limit?: number;
  onTaskPress: (taskId: string) => void;
  onViewAll?: () => void;
  titleColor?: string;
  icon?: string;
  iconColor?: string;
}

export function TaskPreviewSection({
  title,
  tasks,
  limit = 5,
  onTaskPress,
  onViewAll,
  titleColor = '#6b7280',
  icon,
  iconColor,
}: TaskPreviewSectionProps) {
  if (tasks.length === 0) return null;

  const preview = tasks.slice(0, limit);
  const remaining = tasks.length - preview.length;

  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-2 mb-2">
        {icon && <Ionicons name={icon as any} size={14} color={iconColor || titleColor} />}
        <Text
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: titleColor }}
        >
          {title} · {tasks.length}
        </Text>
      </View>

      {preview.map((task) => (
        <TaskCard key={task.id} task={task} onPress={() => onTaskPress(task.id)} />
      ))}

      {remaining > 0 && onViewAll && (
        <Pressable onPress={onViewAll} className="flex-row items-center justify-center py-2 mt-1">
          <Text className="text-xs font-medium text-gray-400">
            View all ({tasks.length})
          </Text>
          <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
        </Pressable>
      )}
    </View>
  );
}
