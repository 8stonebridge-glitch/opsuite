import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEmployeeSummaries, useAllEmployeePerformances, useSubadminPerformance, useTeams, useAvailability } from '../../src/store/selectors';
import { getActiveAvailability } from '../../src/utils/availability-helpers';
import { getToday } from '../../src/utils/date';
import type { Team } from '../../src/types';
import { Avatar } from '../../src/components/ui/Avatar';
import { Card } from '../../src/components/ui/Card';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { EmployeeSummaryCard } from '../../src/components/people/EmployeeSummaryCard';
import { ScoreBadge } from '../../src/components/performance/ScoreBadge';

const PREVIEW_LIMIT = 8;

export default function OwnerPeopleScreen() {
  const teams = useTeams();
  const summaries = useEmployeeSummaries();
  const allPerfs = useAllEmployeePerformances();
  const availability = useAvailability();
  const today = getToday();
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <RoleSwitcher />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Teams
          </Text>

          {teams.map((team) => {
            const isExpanded = expandedTeam === team.id;
            const allMembers = [team.lead, ...team.members];
            const isShowingAll = showAll[team.id];
            const visibleMembers = isShowingAll
              ? allMembers
              : allMembers.slice(0, PREVIEW_LIMIT);
            const remaining = allMembers.length - PREVIEW_LIMIT;

            // Team-level stats
            const teamActiveCount = allMembers.reduce(
              (sum, m) => sum + (summaries.get(m.id)?.activeCount || 0),
              0
            );
            const teamOverdueCount = allMembers.reduce(
              (sum, m) => sum + (summaries.get(m.id)?.overdueCount || 0),
              0
            );
            const teamCheckedIn = allMembers.filter(
              (m) => summaries.get(m.id)?.checkedInToday
            ).length;

            // Team performance score (members only, not lead)
            const memberScores = team.members
              .map((m) => allPerfs.get(m.id))
              .filter(Boolean);
            const teamAvgScore = memberScores.length > 0
              ? Math.round(memberScores.reduce((s, p) => s + p!.score, 0) / memberScores.length)
              : 100;
            const teamBand = teamAvgScore >= 85 ? 'green' as const : teamAvgScore >= 70 ? 'amber' as const : 'red' as const;
            const atRiskCount = memberScores.filter((p) => p!.band !== 'green').length;

            return (
              <View key={team.id} className="mb-3">
                <Pressable
                  onPress={() => setExpandedTeam(isExpanded ? null : team.id)}
                >
                  <Card className="flex-row items-center gap-3">
                    <Avatar name={team.name} color={team.color} />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900">
                        {team.name}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {allMembers.length} people · {teamActiveCount} active
                        {teamOverdueCount > 0
                          ? ` · ${teamOverdueCount} overdue`
                          : ''}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <ScoreBadge score={teamAvgScore} band={teamBand} size="sm" />
                      {atRiskCount > 0 && (
                        <Text className="text-[9px] text-amber-500 font-medium">
                          {atRiskCount} at risk
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color="#9ca3af"
                    />
                  </Card>
                </Pressable>

                {isExpanded && (
                  <Card className="mt-1.5 ml-2">
                    {visibleMembers.map((member, idx) => {
                      const summary = summaries.get(member.id) || {
                        activeCount: 0,
                        overdueCount: 0,
                        lastActivity: null,
                        checkedInToday: false,
                      };
                      const perf = allPerfs.get(member.id);
                      const activeAvail = getActiveAvailability(member.id, today, availability);
                      const availBadge = activeAvail
                        ? {
                            label: activeAvail.type === 'sick' ? 'Sick' : activeAvail.type === 'leave' ? 'On leave' : 'Off duty',
                            color: activeAvail.type === 'sick' ? '#ef4444' : activeAvail.type === 'leave' ? '#3b82f6' : '#6366f1',
                          }
                        : null;
                      return (
                        <EmployeeSummaryCard
                          key={member.id}
                          name={member.name}
                          teamColor={team.color}
                          summary={summary}
                          isLead={member.id === team.lead.id}
                          last={idx === visibleMembers.length - 1 && remaining <= 0}
                          score={perf?.score}
                          band={perf?.band}
                          topAction={perf?.actions[0]?.label}
                          availabilityBadge={availBadge}
                        />
                      );
                    })}
                    {remaining > 0 && !isShowingAll && (
                      <Pressable
                        onPress={() =>
                          setShowAll((prev) => ({ ...prev, [team.id]: true }))
                        }
                        className="py-2 items-center"
                      >
                        <Text className="text-xs font-medium text-gray-400">
                          View all ({allMembers.length})
                        </Text>
                      </Pressable>
                    )}
                  </Card>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
