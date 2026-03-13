import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useEmployeeSummaries, useAllEmployeePerformances, useSubadminPerformance, useTeams, useAvailability } from '../../src/store/selectors';
import { getActiveAvailability } from '../../src/utils/availability-helpers';
import { getToday } from '../../src/utils/date';
import type { Team } from '../../src/types';
import { Avatar } from '../../src/components/ui/Avatar';
import { Card } from '../../src/components/ui/Card';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { EmployeeSummaryCard } from '../../src/components/people/EmployeeSummaryCard';
import { ScoreBadge } from '../../src/components/performance/ScoreBadge';
import { Select } from '../../src/components/ui/Select';
import { Button } from '../../src/components/ui/Button';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { useIndustryColor } from '../../src/store/selectors';
import { uid } from '../../src/utils/id';

const PREVIEW_LIMIT = 8;

interface LeadOption {
  label: string;
  value: string;
  userId?: string;
  userName?: string;
}

export default function OwnerPeopleScreen() {
  const { state, dispatch } = useApp();
  const teams = useTeams();
  const color = useIndustryColor();
  const summaries = useEmployeeSummaries();
  const allPerfs = useAllEmployeePerformances();
  const availability = useAvailability();
  const today = getToday();
  const { clerkEnabled } = useBackendAuth();
  const createTeam = useMutation(api.teams.create);
  const membershipDirectory = useQuery(
    api.memberships.listForActiveOrganization,
    !state.isDemo && clerkEnabled ? {} : 'skip'
  );
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#6366f1');
  const [teamSiteId, setTeamSiteId] = useState(state.onboarding.sites[0]?.id || '');
  const [teamLeadMembershipId, setTeamLeadMembershipId] = useState('');
  const [demoLeadName, setDemoLeadName] = useState('');
  const [teamError, setTeamError] = useState('');
  const [isSavingTeam, setIsSavingTeam] = useState(false);

  const leadOptions = useMemo<LeadOption[]>(() => {
    const existingLeadIds = new Set(teams.map((team) => team.lead.id));

    if (state.isDemo) {
      return teams.map((team) => ({
        label: `${team.lead.name} · ${team.name}`,
        value: team.lead.id,
      }));
    }

    return (membershipDirectory || [])
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .filter((entry) => entry.membership.role === 'subadmin')
      .filter((entry) => !existingLeadIds.has(String(entry.user._id)))
      .map((entry) => ({
        label: entry.user.name,
        value: String(entry.membership._id),
        userId: String(entry.user._id),
        userName: entry.user.name,
      }));
  }, [membershipDirectory, state.isDemo, teams]);

  const canCreateRealTeam = state.isDemo || leadOptions.length > 0;

  const handleCreateTeam = async () => {
    const trimmedTeamName = teamName.trim();

    if (trimmedTeamName.length < 2) {
      setTeamError('Enter a team name with at least 2 characters.');
      return;
    }

    if (!teamSiteId) {
      setTeamError('Choose the site this team belongs to.');
      return;
    }

    if (state.isDemo) {
      if (demoLeadName.trim().length < 2) {
        setTeamError('Enter a lead name for this demo team.');
        return;
      }
    } else if (!teamLeadMembershipId) {
      setTeamError('Select a subadmin lead before creating the team.');
      return;
    }

    setTeamError('');
    setIsSavingTeam(true);

    try {
      if (state.isDemo) {
        const nextTeamId = uid();
        dispatch({
          type: 'ADD_TEAM',
          team: {
            id: nextTeamId,
            name: trimmedTeamName,
            color: teamColor,
            lead: {
              id: uid(),
              name: demoLeadName.trim(),
              role: 'subadmin',
              teamId: nextTeamId,
              teamName: trimmedTeamName,
            },
            members: [],
          },
        });
      } else {
        const selectedLead = leadOptions.find((option) => option.value === teamLeadMembershipId);
        const createdTeam = await createTeam({
          name: trimmedTeamName,
          color: teamColor,
          siteId: teamSiteId as never,
          subadminMembershipId: teamLeadMembershipId as never,
        });

        if (createdTeam && selectedLead) {
          dispatch({
            type: 'ADD_TEAM',
            team: {
              id: String(createdTeam._id),
              name: createdTeam.name,
              color: createdTeam.color || teamColor,
              lead: {
                id: selectedLead.userId || uid(),
                name: selectedLead.userName || 'Lead',
                role: 'subadmin',
                teamId: String(createdTeam._id),
                teamName: createdTeam.name,
              },
              members: [],
            },
          });
        }
      }

      setTeamName('');
      setTeamColor('#6366f1');
      setTeamLeadMembershipId('');
      setDemoLeadName('');
      setTeamSiteId(state.onboarding.sites[0]?.id || '');
      setShowCreateTeam(false);
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : 'We could not create that team yet.');
    } finally {
      setIsSavingTeam(false);
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
        <View className="px-5 pt-4">
          <View className="flex-row items-center justify-between gap-3 mb-3">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-1">
              Teams
            </Text>
            <Pressable
              onPress={() => setShowCreateTeam(true)}
              className="flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-gray-200"
            >
              <Ionicons name="add" size={16} color={color} />
              <Text className="text-xs font-semibold" style={{ color }}>
                Add Team
              </Text>
            </Pressable>
          </View>

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

      <Modal visible={showCreateTeam} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/30" onPress={() => setShowCreateTeam(false)} />
        <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-base font-bold text-gray-900">Add Team</Text>
            <Pressable onPress={() => setShowCreateTeam(false)}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </Pressable>
          </View>

          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Team Name
          </Text>
          <TextInput
            className="bg-gray-50 rounded-2xl px-4 py-3.5 text-base text-gray-900 mb-4"
            placeholder="Operations North"
            value={teamName}
            onChangeText={(text) => {
              setTeamName(text);
              setTeamError('');
            }}
            placeholderTextColor="#d1d5db"
          />

          <Select
            label="Site"
            placeholder="Choose a site"
            options={state.onboarding.sites.map((site) => ({
              label: site.name,
              value: site.id,
            }))}
            value={teamSiteId}
            onChange={(value) => {
              setTeamSiteId(value);
              setTeamError('');
            }}
          />

          <View className="mt-4">
            {state.isDemo ? (
              <>
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Lead Name
                </Text>
                <TextInput
                  className="bg-gray-50 rounded-2xl px-4 py-3.5 text-base text-gray-900"
                  placeholder="Enter a lead name"
                  value={demoLeadName}
                  onChangeText={(text) => {
                    setDemoLeadName(text);
                    setTeamError('');
                  }}
                  placeholderTextColor="#d1d5db"
                />
              </>
            ) : (
              <Select
                label="Subadmin Lead"
                placeholder={
                  leadOptions.length > 0
                    ? 'Choose a lead'
                    : 'Invite a subadmin first'
                }
                options={leadOptions}
                value={teamLeadMembershipId}
                onChange={(value) => {
                  setTeamLeadMembershipId(value);
                  setTeamError('');
                }}
              />
            )}
          </View>

          <View className="mt-4">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Team Color
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {['#6366f1', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'].map((swatch) => {
                const selected = teamColor === swatch;
                return (
                  <Pressable
                    key={swatch}
                    onPress={() => setTeamColor(swatch)}
                    className={`w-10 h-10 rounded-full items-center justify-center ${selected ? 'border-2 border-gray-900' : ''}`}
                    style={{ backgroundColor: swatch }}
                  >
                    {selected ? <Ionicons name="checkmark" size={16} color="white" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {!state.isDemo && !canCreateRealTeam ? (
            <Text className="text-sm text-gray-400 leading-6 mt-5">
              This org does not have any available subadmins yet. Create or invite a subadmin first, then you can attach that lead to a new team.
            </Text>
          ) : (
            <Text className="text-sm text-gray-400 leading-6 mt-5">
              Teams show up in owner, subadmin, and employee views. We keep the lead attached at creation so the team has a clear owner from day one.
            </Text>
          )}

          {teamError ? (
            <Text className="text-sm text-red-600 mt-4">{teamError}</Text>
          ) : null}

          <View className="mt-5">
            <Button
              title={isSavingTeam ? 'Creating team...' : 'Create Team'}
              onPress={() => void handleCreateTeam()}
              disabled={isSavingTeam || (!state.isDemo && !canCreateRealTeam)}
              color={color}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
