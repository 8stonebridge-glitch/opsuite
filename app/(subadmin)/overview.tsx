import { useMemo } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store/AppContext';
import {
  useBucketedTasks,
  useActiveGroups,
  useCheckInHealth,
  useTeamMemberIds,
  useIndustryColor,
  useMyTeam,
  useSubadminPerformance,
  useNeedsDelegation,
  useTeams,
  usePendingRequests,
  useAwayToday,
  useCoverageNeeded,
} from '../../src/store/selectors';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { KpiRow } from '../../src/components/overview/KpiRow';
import { Card } from '../../src/components/ui/Card';
import { ScoreBadge, BandLabel } from '../../src/components/performance/ScoreBadge';
import { AtRiskSection } from '../../src/components/performance/AtRiskSection';
import { AvailabilityRequestCard } from '../../src/components/availability/AvailabilityRequestCard';
import { Avatar } from '../../src/components/ui/Avatar';
import { computeEmployeePerformance } from '../../src/utils/performance';

export default function SubAdminOverviewScreen() {
  const { state } = useApp();
  const color = useIndustryColor();
  const teams = useTeams();
  const team = useMyTeam();
  const memberIds = useTeamMemberIds();
  const { active, review } = useBucketedTasks();
  const { overdue, stalled } = useActiveGroups();
  const checkInHealth = useCheckInHealth(memberIds);
  const teamPerf = useSubadminPerformance(team?.id || '');
  const needsDelegation = useNeedsDelegation();
  const pendingRequests = usePendingRequests();
  const awayToday = useAwayToday();
  const coverageNeeded = useCoverageNeeded();

  // At-risk employees in this team
  const atRiskPerfs = useMemo(() => {
    if (!team) return [];
    return team.members
      .map((m) => computeEmployeePerformance(m.id, state.tasks, state.checkIns, teams, state.availability))
      .filter((p) => p.band !== 'green')
      .sort((a, b) => a.score - b.score);
  }, [team, state.tasks, state.checkIns, teams, state.availability]);

  // Recent audit entries for this team's tasks
  const teamTaskIds = new Set(
    state.tasks.filter((t) => memberIds.includes(t.assigneeId)).map((t) => t.id)
  );
  const recentAudit = state.audit
    .filter((a) => a.taskId && teamTaskIds.has(a.taskId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <RoleSwitcher />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4 gap-5">
          <KpiRow
            items={[
              { label: 'Active', value: active.length, color },
              { label: 'Review', value: review.length, color: '#d97706' },
              { label: 'Overdue', value: overdue.length, color: '#dc2626' },
              { label: 'Stalled', value: stalled.length, color: '#ea580c' },
              ...(awayToday.length > 0 ? [{ label: 'Away', value: awayToday.length, color: '#6366f1' }] : []),
            ]}
          />

          {/* Pending Availability Requests */}
          {pendingRequests.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Pending Requests ({pendingRequests.length})
              </Text>
              <View className="gap-2">
                {pendingRequests.map((r) => (
                  <AvailabilityRequestCard key={r.id} record={r} approverId={state.userId || ''} />
                ))}
              </View>
            </View>
          )}

          {/* Away Today */}
          {awayToday.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Away Today ({awayToday.length})
              </Text>
              <Card>
                {awayToday.map((emp, i) => (
                  <View
                    key={emp.id}
                    className={`flex-row items-center gap-3 py-2.5 ${i < awayToday.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <Avatar name={emp.name} color={team?.color || '#6366f1'} size="sm" />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-gray-900">{emp.name}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {/* Coverage Needed */}
          {coverageNeeded.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Coverage Needed ({coverageNeeded.length})
              </Text>
              <Card>
                {coverageNeeded.slice(0, 5).map((task, i) => (
                  <View
                    key={task.id}
                    className={`flex-row items-center gap-3 py-2.5 ${i < Math.min(coverageNeeded.length, 5) - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <View className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <View className="flex-1">
                      <Text className="text-sm text-gray-900" numberOfLines={1}>{task.title}</Text>
                      <Text className="text-xs text-gray-400">{task.site} · {task.assignee}</Text>
                    </View>
                    <View className="px-2 py-0.5 rounded-full bg-orange-50">
                      <Text className="text-[10px] font-semibold text-orange-600">Coverage</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {/* Needs Delegation */}
          {needsDelegation.length > 0 && (
            <Card>
              <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name="arrow-redo" size={16} color="#6366f1" />
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Needs Delegation
                </Text>
              </View>
              <Text className="text-2xl font-bold text-gray-900">
                {needsDelegation.length}
              </Text>
              <Text className="text-xs text-gray-400 mt-1">
                {needsDelegation.length === 1 ? 'task' : 'tasks'} assigned to you — delegate to a team member
              </Text>
            </Card>
          )}

          {/* Handoffs Today */}
          <Card>
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="hand-left" size={16} color="#059669" />
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Handoffs Today
              </Text>
            </View>
            <View className="flex-row items-end gap-2">
              <Text className="text-3xl font-bold text-gray-900">
                {checkInHealth.checkedInToday}
              </Text>
              <Text className="text-base text-gray-400 mb-1">
                / {checkInHealth.total}
              </Text>
              <View className="flex-1" />
              <Text
                className="text-lg font-bold mb-0.5"
                style={{ color: checkInHealth.rate >= 80 ? '#059669' : checkInHealth.rate >= 50 ? '#d97706' : '#dc2626' }}
              >
                {checkInHealth.rate}%
              </Text>
            </View>
            <View className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">
              <View
                className="h-2 rounded-full"
                style={{
                  width: `${checkInHealth.rate}%`,
                  backgroundColor: checkInHealth.rate >= 80 ? '#059669' : checkInHealth.rate >= 50 ? '#d97706' : '#dc2626',
                }}
              />
            </View>
          </Card>

          {/* Team Performance */}
          <Card>
            <View className="flex-row items-center gap-3">
              <ScoreBadge score={teamPerf.score} band={teamPerf.band} trendDelta={teamPerf.trendDelta} size="md" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">Team Performance</Text>
                <View className="flex-row items-center gap-2 mt-1">
                  <BandLabel band={teamPerf.band} />
                  {teamPerf.atRiskCount > 0 && (
                    <Text className="text-[10px] text-amber-500 font-medium">
                      {teamPerf.atRiskCount} at risk
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </Card>

          {/* At-Risk Employees */}
          <AtRiskSection employees={atRiskPerfs} limit={5} />

          {/* Recent Activity */}
          {recentAudit.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Recent Activity
              </Text>
              <Card className="gap-0">
                {recentAudit.map((entry, i) => (
                  <View
                    key={entry.id}
                    className={`flex-row gap-3 py-3 ${i < recentAudit.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <View className="w-1.5 rounded-full mt-1" style={{ height: 14, backgroundColor: getAuditColor(entry.updateType) }} />
                    <View className="flex-1">
                      <Text className="text-xs text-gray-700" numberOfLines={2}>{entry.message}</Text>
                      <Text className="text-[10px] text-gray-300 mt-0.5">{entry.dateTag}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getAuditColor(type: string): string {
  if (type === 'Rework' || type === 'Escalation') return '#dc2626';
  if (type === 'Status') return '#3b82f6';
  if (type === 'Assignment' || type === 'Delegated') return '#059669';
  if (type === 'Approval' || type === 'Verification') return '#7c3aed';
  if (type === 'No Change') return '#d97706';
  return '#9ca3af';
}
