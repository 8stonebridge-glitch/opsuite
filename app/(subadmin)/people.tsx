import { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import { useMyTeam, useIndustryColor, useEmployeeSummaries, useAllEmployeePerformances, useAvailability } from '../../src/store/selectors';
import { isStalledTask } from '../../src/utils/task-helpers';
import { getToday } from '../../src/utils/date';
import { getActiveAvailability } from '../../src/utils/availability-helpers';
import { Avatar } from '../../src/components/ui/Avatar';
import { Card } from '../../src/components/ui/Card';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ScoreBadge } from '../../src/components/performance/ScoreBadge';

export default function SubAdminPeopleScreen() {
  const { state } = useApp();
  const team = useMyTeam();
  const color = useIndustryColor();
  const allPerfs = useAllEmployeePerformances();
  const availability = useAvailability();
  const today = getToday();

  // Compute stalled counts per member and handoff status
  const memberStats = useMemo(() => {
    if (!team) return new Map<string, { stalledCount: number; handoffToday: boolean }>();
    const threshold = state.orgSettings.noChangeAlertWorkdays;
    const map = new Map<string, { stalledCount: number; handoffToday: boolean }>();
    for (const m of [...team.members, team.lead]) {
      const memberTasks = state.tasks.filter((t) => t.assigneeId === m.id);
      const stalledCount = memberTasks.filter((t) => isStalledTask(t, state.audit, threshold)).length;
      const handoffToday = state.handoffs.some((h) => h.userId === m.id && h.date === today);
      map.set(m.id, { stalledCount, handoffToday });
    }
    return map;
  }, [team, state.tasks, state.audit, state.handoffs, state.orgSettings.noChangeAlertWorkdays, today]);

  if (!team) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
        <RoleSwitcher />
        <EmptyState icon="people-outline" title="No team found" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <RoleSwitcher />
      <View className="px-5 pt-4">
        <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
          {team.name} Team · {team.members.length} members
        </Text>
      </View>
      <FlatList
        data={[team.lead, ...team.members]}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        renderItem={({ item: member, index }) => {
          const perf = allPerfs.get(member.id);
          const topAction = perf?.actions[0];
          const stats = memberStats.get(member.id);
          const activeAvail = getActiveAvailability(member.id, today, availability);
          return (
            <Card className="flex-row items-center gap-3 mb-2">
              <Avatar name={member.name} color={index === 0 ? team.color : '#6b7280'} size="sm" />
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</Text>
                  {stats?.handoffToday && (
                    <Ionicons name="checkmark-circle" size={12} color="#059669" />
                  )}
                  {activeAvail && (
                    <View
                      className="px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor:
                          (activeAvail.type === 'sick' ? '#ef4444' : activeAvail.type === 'leave' ? '#3b82f6' : '#6366f1') + '15',
                      }}
                    >
                      <Text
                        className="text-[9px] font-semibold"
                        style={{
                          color: activeAvail.type === 'sick' ? '#ef4444' : activeAvail.type === 'leave' ? '#3b82f6' : '#6366f1',
                        }}
                      >
                        {activeAvail.type === 'sick' ? 'Sick' : activeAvail.type === 'leave' ? 'On leave' : 'Off duty'}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-gray-400 dark:text-gray-500">
                    {index === 0 ? 'Team Lead' : 'Member'}
                    {topAction ? ` · ${topAction.label}` : ''}
                  </Text>
                  {stats && stats.stalledCount > 0 && (
                    <Text className="text-[10px] text-amber-600 font-medium">
                      {stats.stalledCount} stalled
                    </Text>
                  )}
                </View>
              </View>
              {perf && <ScoreBadge score={perf.score} band={perf.band} size="sm" />}
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}
