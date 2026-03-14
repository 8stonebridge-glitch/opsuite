import { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
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
  const { authEnabled, email, fullName } = useBackendAuth();
  const color = useIndustryColor();
  const teams = useTeams();
  const { active, review } = useBucketedTasks();
  const { overdue, stalled } = useActiveGroups();
  const atRisk = useAtRiskEmployees(5);
  const pendingRequests = usePendingRequests();
  const awayToday = useAwayToday();
  const coverageNeeded = useCoverageNeeded();
  const sendWelcomeTest = useAction(api.emails.sendWelcome);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailMessage, setTestEmailMessage] = useState('');

  const handleSendTestEmail = async () => {
    setTestEmailMessage('');
    setIsSendingTestEmail(true);

    try {
      const result = await sendWelcomeTest({
        email: email || undefined,
        name: fullName || undefined,
      });

      if (result.ok) {
        setTestEmailMessage(`Test email sent to ${result.to}`);
      } else {
        setTestEmailMessage(result.error);
      }
    } catch (error) {
      setTestEmailMessage(error instanceof Error ? error.message : 'We could not send the test email yet.');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <RoleSwitcher />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4 gap-5">
          {!state.isDemo && authEnabled ? (
            <Card>
              <View className="flex-row items-start gap-3">
                <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center">
                  <Text className="text-base">✉️</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">
                    Temporary Resend Test
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1 leading-5">
                    Send a welcome email to {email || 'your signed-in address'} using the new Convex action.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => void handleSendTestEmail()}
                disabled={isSendingTestEmail}
                className="mt-4 py-3 rounded-2xl items-center"
                style={{ backgroundColor: isSendingTestEmail ? '#e5e7eb' : color }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: isSendingTestEmail ? '#9ca3af' : '#ffffff' }}
                >
                  {isSendingTestEmail ? 'Sending test email...' : 'Send test welcome email'}
                </Text>
              </Pressable>
              {testEmailMessage ? (
                <Text className="text-xs text-gray-500 mt-3 leading-5">{testEmailMessage}</Text>
              ) : null}
            </Card>
          ) : null}

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
                  <AvailabilityRequestCard key={r.id} record={r} approverId="admin" />
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
                    <Avatar name={emp.name} color={emp.teamId ? '#6366f1' : '#9ca3af'} size="sm" />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-gray-900">{emp.name}</Text>
                      <Text className="text-xs text-gray-400">{emp.teamName}</Text>
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

          {/* Sites */}
          <View>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
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
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Teams
            </Text>
            <View className="gap-2">
              {teams.map((team) => (
                <TeamHealthRow key={team.id} teamId={team.id} teamName={team.name} teamColor={team.color} leadName={team.lead.name} memberCount={team.members.length} />
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
