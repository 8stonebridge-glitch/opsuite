import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../src/store/AppContext';
import {
  useBucketedTasks,
  useActiveGroups,
  useSiteHealth,
  useTeamHealth,
  useIndustryColor,
  useAtRiskEmployees,
  useSubadminPerformance,
  useTeams,
  usePendingRequests,
  useAwayToday,
  useCoverageNeeded,
} from '../../src/store/selectors';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { KpiRow } from '../../src/components/overview/KpiRow';
import { HealthCard } from '../../src/components/overview/HealthCard';
import { AtRiskSection } from '../../src/components/performance/AtRiskSection';
import { ScoreBadge } from '../../src/components/performance/ScoreBadge';
import { AvailabilityRequestCard } from '../../src/components/availability/AvailabilityRequestCard';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { useBackendAuth } from '../../src/providers/BackendProviders';

export default function OwnerOverviewScreen() {
  const { state } = useApp();
  const { authEnabled, isSignedIn } = useBackendAuth();
  const color = useIndustryColor();
  const teams = useTeams();
  const { active, review } = useBucketedTasks();
  const { overdue, stalled } = useActiveGroups();
  const atRisk = useAtRiskEmployees(5);
  const pendingRequests = usePendingRequests();
  const awayToday = useAwayToday();
  const coverageNeeded = useCoverageNeeded();

  // Show loading spinner while workspace data is being hydrated from Convex
  if (authEnabled && isSignedIn && !state.onboarding.orgName) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950 items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={color} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
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
              <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Pending Requests ({pendingRequests.length})
              </Text>
              <View className="gap-2">
                {pendingRequests.map((r) => (
                  <AvailabilityRequestCard key={r.id} record={r} approverId="admin" />
                ))}
              </View>
            </View>
          )}

          {/* Away Today */}
          {awayToday.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Away Today ({awayToday.length})
              </Text>
              <Card>
                {awayToday.map((emp, i) => (
                  <View
                    key={emp.id}
                    className={`flex-row items-center gap-3 py-2.5 ${i < awayToday.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}
                  >
                    <Avatar name={emp.name} color={emp.teamId ? '#6366f1' : '#9ca3af'} size="sm" />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{emp.name}</Text>
                      <Text className="text-xs text-gray-400 dark:text-gray-500">{emp.teamName}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {/* Coverage Needed */}
          {coverageNeeded.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Coverage Needed ({coverageNeeded.length})
              </Text>
              <Card>
                {coverageNeeded.slice(0, 5).map((task, i) => (
                  <View
                    key={task.id}
                    className={`flex-row items-center gap-3 py-2.5 ${i < Math.min(coverageNeeded.length, 5) - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}
                  >
                    <View className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <View className="flex-1">
                      <Text className="text-sm text-gray-900 dark:text-gray-100" numberOfLines={1}>{task.title}</Text>
                      <Text className="text-xs text-gray-400 dark:text-gray-500">{task.site} · {task.assignee}</Text>
                    </View>
                    <View className="px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950">
                      <Text className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">Coverage</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {/* Sites */}
          <View>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              {state.onboarding.industry?.sitesLabel || 'Sites'}
            </Text>
            <View className="gap-2">
              {state.onboarding.sites.map((site) => (
                <SiteHealthRow key={site.id} siteId={site.id} siteName={site.name} />
              ))}
            </View>
          </View>

          {/* Teams */}
          <View>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Teams
            </Text>
            <View className="gap-2">
              {teams.map((team) => (
                <TeamHealthRow key={team.id} teamId={team.id} teamName={team.name} teamColor={team.color} leadName={team.lead.name} memberCount={team.members.length + 1} />
              ))}
            </View>
          </View>

          {/* At-Risk Employees */}
          <AtRiskSection employees={atRisk} limit={5} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SiteHealthRow({ siteId, siteName }: { siteId: string; siteName: string }) {
  const health = useSiteHealth(siteId);
  return (
    <HealthCard
      title={siteName}
      icon="location"
      iconColor="#6366f1"
      stats={[
        { label: 'Active', value: health.totalActive, color: '#3b82f6' },
        { label: 'Overdue', value: health.overdue, color: '#dc2626' },
        { label: 'Review', value: health.review, color: '#d97706' },
        { label: 'Check-in', value: `${health.checkInRate}%`, color: '#059669' },
      ]}
    />
  );
}

function TeamHealthRow({
  teamId,
  teamName,
  teamColor,
  leadName,
  memberCount,
}: {
  teamId: string;
  teamName: string;
  teamColor: string;
  leadName: string;
  memberCount: number;
}) {
  const health = useTeamHealth(teamId);
  const teamPerf = useSubadminPerformance(teamId);
  return (
    <HealthCard
      title={teamName}
      subtitle={`${leadName} · ${memberCount} people`}
      icon="people"
      iconColor={teamColor}
      stats={[
        { label: 'Active', value: health.totalActive, color: '#3b82f6' },
        { label: 'Overdue', value: health.overdue, color: '#dc2626' },
        { label: 'Review', value: health.review, color: '#d97706' },
        { label: 'Done/wk', value: health.completedThisWeek, color: '#059669' },
      ]}
      rightContent={
        <ScoreBadge score={teamPerf.score} band={teamPerf.band} size="sm" />
      }
    />
  );
}
