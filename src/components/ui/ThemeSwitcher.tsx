import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ThemePreference } from '../../providers/ThemeProvider';

const OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Light', icon: 'sunny' },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export function ThemeSwitcher() {
  const { preference, setTheme, isDark } = useTheme();

  return (
    <View>
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons
          name="color-palette-outline"
          size={18}
          color={isDark ? '#6b7280' : '#9ca3af'}
        />
        <Text className="text-sm text-gray-700 dark:text-gray-300">
          Appearance
        </Text>
      </View>
      <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {OPTIONS.map((opt) => {
          const active = preference === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setTheme(opt.value)}
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg ${
                active
                  ? 'bg-white dark:bg-gray-700 shadow-sm'
                  : ''
              }`}
              style={active ? { elevation: 1 } : undefined}
            >
              <Ionicons
                name={opt.icon}
                size={15}
                color={
                  active
                    ? isDark
                      ? '#e5e7eb'
                      : '#111827'
                    : isDark
                      ? '#6b7280'
                      : '#9ca3af'
                }
              />
              <Text
                className={`text-xs font-semibold ${
                  active
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
