import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInbox } from './InboxProvider';
import { useTheme } from '../../providers/ThemeProvider';

export function InboxButton() {
  const { unreadCount, openInbox } = useInbox();
  const { isDark } = useTheme();

  return (
    <Pressable onPress={openInbox} className="relative p-1">
      <Ionicons name="notifications-outline" size={22} color={isDark ? '#d1d5db' : '#374151'} />
      {unreadCount > 0 && (
        <View className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full min-w-[16px] h-4 items-center justify-center px-1">
          <Text className="text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
