import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../ui/Avatar';
import { ScoreBadge } from '../performance/ScoreBadge';
import { useTheme } from '../../providers/ThemeProvider';
import type { EmployeeSummary } from '../../store/selectors';
import type { ScoreBand } from '../../types';

interface Props {
  name: string;
  teamColor: string;
  summary: EmployeeSummary;
  isLead?: boolean;
  last?: boolean;
  score?: number;
  band?: ScoreBand;
  topAction?: string;
  availabilityBadge?: { label: string; color: string } | null;
  onPress?: () => void;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function EmployeeSummaryCard({ name, teamColor, summary, isLead, last, score, band, topAction, availabilityBadge, onPress }: Props) {
  const { isDark } = useTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      {...(onPress ? { onPress } : {})}
      className={`flex-row items-center py-3 gap-3 ${last ? '' : 'border-b border-gray-100 dark:border-gray-800'}`}
    >
      <Avatar name={name} color={teamColor} size="sm" />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{name}</Text>
          {isLead && (
            <View className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
              <Text className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">LEAD</Text>
            </View>
          )}
          {availabilityBadge && (
            <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: availabilityBadge.color + '15' }}>
              <Text className="text-[9px] font-semibold" style={{ color: availabilityBadge.color }}>
                {availabilityBadge.label}
              </Text>
            </View>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-gray-400 dark:text-gray-500">
            {summary.activeCount} active
          </Text>
          {summary.overdueCount > 0 && (
            <Text className="text-xs text-red-500">
              {summary.overdueCount} overdue
            </Text>
          )}
          <Text className="text-xs text-gray-300 dark:text-gray-600">
            {relativeTime(summary.lastActivity)}
          </Text>
        </View>
      </View>
      {/* Score badge or check-in dot */}
      {score !== undefined && band ? (
        <ScoreBadge score={score} band={band} size="sm" />
      ) : (
        <View
          className="w-2.5 h-2.5 rounded-full"
          style={{
            backgroundColor: summary.checkedInToday ? '#059669' : isDark ? '#4b5563' : '#d1d5db',
          }}
        />
      )}
    </Wrapper>
  );
}
