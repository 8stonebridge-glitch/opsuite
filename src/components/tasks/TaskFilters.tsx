import { View, Text, Pressable } from 'react-native';

export type FilterValue = 'active' | 'review' | 'done';

interface TaskFiltersProps {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  color?: string;
  counts?: { active: number; review: number; done: number };
}

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

export function TaskFilters({ value, onChange, color = '#059669', counts }: TaskFiltersProps) {
  return (
    <View className="flex-row rounded-2xl bg-gray-200 p-1 mb-4">
      {FILTERS.map((f) => {
        const isActive = value === f.value;
        const count = counts?.[f.value];
        return (
          <Pressable
            key={f.value}
            onPress={() => onChange(f.value)}
            className={`flex-1 py-2.5 rounded-xl items-center ${isActive ? 'bg-white shadow-sm' : ''}`}
          >
            <Text className={`text-sm font-semibold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
              {f.label}
              {count !== undefined ? (
                <Text className={`font-normal ${isActive ? 'text-gray-400' : 'text-gray-400'}`}>
                  {' '}{count}
                </Text>
              ) : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
