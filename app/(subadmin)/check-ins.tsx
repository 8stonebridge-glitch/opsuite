import { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import { useMyTeam, useIndustryColor } from '../../src/store/selectors';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { getToday } from '../../src/utils/date';
import { getCurrentWeekDays, getDayLabel } from '../../src/utils/checkin-helpers';

export default function SubAdminCheckInsScreen() {
  const { state } = useApp();
  const team = useMyTeam();
  const color = useIndustryColor();
  const today = getToday();

  const memberIds = useMemo(
    () => (team ? [team.lead.id, ...team.members.map((m) => m.id)] : []),
    [team]
  );

  const teamCheckIns = useMemo(
    () =>
      state.checkIns
        .filter((c) => memberIds.includes(c.userId))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [state.checkIns, memberIds]
  );

  const todayCount = teamCheckIns.filter((c) => c.date === today && c.status === 'Checked-In').length;

  const getName = (userId: string) => {
    if (!team) return userId;
    if (team.lead.id === userId) return team.lead.name;
    const m = team.members.find((e) => e.id === userId);
    return m?.name || userId;
  };

  // Team 7-day overview
  const weekDays = getCurrentWeekDays(today);
  const weeklyStats = useMemo(() => {
    return weekDays.map((day) => {
      const isFuture = day > today;
      const dow = new Date(`${day}T12:00:00`).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const checkedCount = isFuture || isWeekend
        ? 0
        : teamCheckIns.filter((c) => c.date === day && c.status === 'Checked-In').length;
      return { date: day, checkedCount, isFuture, isWeekend };
    });
  }, [weekDays, teamCheckIns, today]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <RoleSwitcher />

      <View className="px-5 pt-4">
        {/* Summary */}
        <Card className="mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold" style={{ color }}>{todayCount}</Text>
              <Text className="text-xs text-gray-400">Checked in today</Text>
            </View>
            <View>
              <Text className="text-2xl font-bold text-gray-900">{memberIds.length}</Text>
              <Text className="text-xs text-gray-400">Team members</Text>
            </View>
          </View>
        </Card>

        {/* Team 7-Day Strip */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          This Week
        </Text>
        <Card className="mb-4">
          <View className="flex-row justify-between">
            {weeklyStats.map((ws) => (
              <View key={ws.date} className="items-center flex-1">
                <Text className={`text-xs mb-1 ${ws.date === today ? 'font-bold text-gray-900' : 'text-gray-400'}`}>
                  {getDayLabel(ws.date)}
                </Text>
                <View
                  className={`h-9 w-9 rounded-full items-center justify-center ${
                    ws.date === today ? 'border-2' : ''
                  }`}
                  style={ws.date === today ? { borderColor: color } : undefined}
                >
                  {ws.isFuture || ws.isWeekend ? (
                    <View className="h-2 w-2 rounded-full bg-gray-200" />
                  ) : (
                    <Text
                      className="text-sm font-bold"
                      style={{ color: ws.checkedCount === memberIds.length ? '#059669' : ws.checkedCount > 0 ? '#d97706' : '#dc2626' }}
                    >
                      {ws.checkedCount}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Recent Check-ins
        </Text>
      </View>

      <FlatList
        data={teamCheckIns}
        keyExtractor={(item, i) => `${item.userId}-${item.date}-${i}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <Card className="flex-row items-center gap-3 mb-2">
            <Avatar name={getName(item.userId)} color={item.status === 'Checked-In' ? color : '#9ca3af'} size="sm" />
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-900">{getName(item.userId)}</Text>
              <Text className="text-xs text-gray-400">
                {item.date} · {item.status === 'Checked-In' ? `${item.checkedInAt} · ${item.summary}` : 'Missed'}
              </Text>
            </View>
            <Ionicons
              name={item.status === 'Checked-In' ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={item.status === 'Checked-In' ? '#059669' : '#dc2626'}
            />
          </Card>
        )}
        ListEmptyComponent={<EmptyState icon="notifications-outline" title="No check-ins yet" />}
      />
    </SafeAreaView>
  );
}
