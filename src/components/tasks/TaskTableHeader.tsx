import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../providers/ThemeProvider';

interface TaskTableHeaderProps {
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}

const COLUMNS: { key: string; label: string; flex: number }[] = [
  { key: 'title', label: 'Task', flex: 1 },
  { key: 'status', label: 'Status', flex: 0 },
  { key: 'due', label: 'Due', flex: 0 },
];

export function TaskTableHeader({ sortKey, sortDir, onSort }: TaskTableHeaderProps) {
  const { isDark } = useTheme();
  return (
    <View className="flex-row items-center px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      {/* Spacer for priority dot */}
      <View style={{ width: 14 }} />

      {COLUMNS.map((col) => {
        const isActive = sortKey === col.key;
        return (
          <Pressable
            key={col.key}
            onPress={() => onSort(col.key)}
            className="flex-row items-center gap-0.5"
            style={
              col.flex === 1
                ? { flex: 1, marginRight: 8 }
                : col.key === 'status'
                ? { marginRight: 8 }
                : { width: 80, justifyContent: 'flex-end' }
            }
          >
            <Text
              className={`text-[10px] uppercase tracking-wider font-semibold ${
                isActive ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {col.label}
            </Text>
            {isActive && (
              <Ionicons
                name={sortDir === 'asc' ? 'chevron-up' : 'chevron-down'}
                size={10}
                color={isDark ? '#d1d5db' : '#374151'}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
