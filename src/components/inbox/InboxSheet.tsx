import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useInbox } from './InboxProvider';
import { useApp } from '../../store/AppContext';
import { useTheme } from '../../providers/ThemeProvider';
import type { AppNotification, Role } from '../../types';

// ── Time formatting ──────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

// ── Icon for notification type ───────────────────────────────────────

function iconForType(type: AppNotification['type']): string {
  switch (type) {
    case 'task': return 'clipboard-outline';
    case 'availability': return 'calendar-outline';
    case 'handoff': return 'swap-horizontal-outline';
    case 'coverage': return 'alert-circle-outline';
    case 'review': return 'checkmark-circle-outline';
    default: return 'notifications-outline';
  }
}

// ── Single row ───────────────────────────────────────────────────────

function NotificationRow({
  notification,
  isUnread,
  onPress,
}: {
  notification: AppNotification;
  isUnread: boolean;
  onPress: () => void;
}) {
  const { isDark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-5 py-3.5 active:bg-gray-50 dark:active:bg-gray-800"
    >
      {/* Unread dot */}
      <View className="w-3 items-center mr-2">
        {isUnread && <View className="w-2 h-2 rounded-full bg-emerald-500" />}
      </View>

      {/* Icon */}
      <View className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 items-center justify-center mr-3">
        <Ionicons name={iconForType(notification.type) as any} size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
      </View>

      {/* Content */}
      <View className="flex-1 mr-2">
        <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100" numberOfLines={1}>
          {notification.title}
        </Text>
        <Text className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5" numberOfLines={1}>
          {notification.body}
        </Text>
        <Text className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          {relativeTime(notification.timestamp)}
        </Text>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color={isDark ? '#4b5563' : '#d1d5db'} />
    </Pressable>
  );
}

// ── Sheet ────────────────────────────────────────────────────────────

export function InboxSheet() {
  const { notifications, seenAt, showInbox, closeInbox } = useInbox();
  const { state } = useApp();
  const { isDark } = useTheme();
  const router = useRouter();

  const resolveNotificationPath = (notification: AppNotification, role: Role) => {
    const rolePrefix =
      role === 'admin'
        ? '(owner_admin)'
        : role === 'subadmin'
        ? '(subadmin)'
        : '(employee)';

    if (notification.taskId) {
      return `/${rolePrefix}/tasks/${notification.taskId}`;
    }

    const explicitRoute = notification.route?.replace(/^\/+/, '');
    if (explicitRoute) {
      const routeMap: Record<Role, Record<string, string>> = {
        admin: {
          overview: '/(owner_admin)/overview',
          tasks: '/(owner_admin)/tasks',
          people: '/(owner_admin)/people',
          sites: '/(owner_admin)/sites',
          more: '/(owner_admin)/more',
          availability: '/(owner_admin)/overview',
          handoff: '/(owner_admin)/overview',
        },
        subadmin: {
          overview: '/(subadmin)/overview',
          tasks: '/(subadmin)/tasks',
          people: '/(subadmin)/people',
          'check-ins': '/(subadmin)/check-ins',
          more: '/(subadmin)/more',
          availability: '/(subadmin)/overview',
          handoff: '/(subadmin)/check-ins',
        },
        employee: {
          'my-day': '/(employee)/my-day',
          tasks: '/(employee)/tasks',
          'check-in': '/(employee)/check-in',
          more: '/(employee)/more',
          availability: '/(employee)/more',
          handoff: '/(employee)/check-in',
        },
      };

      const resolved = routeMap[role][explicitRoute];
      if (resolved) return resolved;
    }

    switch (notification.type) {
      case 'availability':
        return role === 'employee' ? '/(employee)/more' : role === 'subadmin' ? '/(subadmin)/overview' : '/(owner_admin)/overview';
      case 'handoff':
        return role === 'employee' ? '/(employee)/check-in' : role === 'subadmin' ? '/(subadmin)/check-ins' : '/(owner_admin)/overview';
      case 'coverage':
      case 'review':
      case 'task':
      default:
        return `/${rolePrefix}/tasks`;
    }
  };

  const handlePress = (notification: AppNotification) => {
    closeInbox();
    let targetPath = resolveNotificationPath(notification, state.role);

    // When a review notification points to the tasks list, auto-select the Review tab
    if (notification.type === 'review' && !notification.taskId && targetPath.endsWith('/tasks')) {
      targetPath += '?filter=review';
    }

    setTimeout(() => {
      router.push(targetPath as any);
    }, 100);
  };

  return (
    <Modal visible={showInbox} transparent animationType="slide">
      <Pressable className="flex-1 bg-black/30 dark:bg-black/50" onPress={closeInbox} />
      <View className="bg-white dark:bg-gray-950 rounded-t-3xl max-h-[75%]">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Inbox</Text>
          <Pressable onPress={closeInbox} className="p-1">
            <Ionicons name="close" size={22} color={isDark ? '#9ca3af' : '#6b7280'} />
          </Pressable>
        </View>

        {/* List */}
        {notifications.length === 0 ? (
          <View className="items-center py-16">
            <Ionicons name="notifications-off-outline" size={40} color={isDark ? '#4b5563' : '#d1d5db'} />
            <Text className="text-sm text-gray-400 dark:text-gray-500 mt-3">No notifications yet</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NotificationRow
                notification={item}
                isUnread={!seenAt || item.timestamp > seenAt}
                onPress={() => handlePress(item)}
              />
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}
