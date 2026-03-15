import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useEmployeeSummaries, useAllEmployeePerformances, useTeams, useAvailability, useOrgMode, useAllEmployees } from '../../src/store/selectors';
import { getActiveAvailability } from '../../src/utils/availability-helpers';
import { getToday } from '../../src/utils/date';
import type { Role, Team } from '../../src/types';
import { Avatar } from '../../src/components/ui/Avatar';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { RoleSwitcher } from '../../src/components/layout/RoleSwitcher';
import { EmployeeSummaryCard } from '../../src/components/people/EmployeeSummaryCard';
import { ScoreBadge } from '../../src/components/performance/ScoreBadge';
import { Select } from '../../src/components/ui/Select';
import { Button } from '../../src/components/ui/Button';
import { useApp } from '../../src/store/AppContext';
import { useBackendAuth } from '../../src/providers/BackendProviders';
import { useIndustryColor } from '../../src/store/selectors';
import { useTheme } from '../../src/providers/ThemeProvider';
import { uid } from '../../src/utils/id';

const PREVIEW_LIMIT = 8;

interface LeadOption {
  label: string;
  value: string;
  userId?: string;
  userName?: string;
}

type MemberRoleOption = 'subadmin' | 'employee';

export default function OwnerPeopleScreen() {
  const { state, dispatch } = useApp();
  const teams = useTeams();
  const allEmployees = useAllEmployees();
  const orgMode = useOrgMode();
  const isDirect = orgMode === 'direct';
  const color = useIndustryColor();
  const { isDark } = useTheme();
  const summaries = useEmployeeSummaries();
  const allPerfs = useAllEmployeePerformances();
  const availability = useAvailability();
  const today = getToday();
  const { authEnabled } = useBackendAuth();
  const createTeam = useMutation(api.teams.create);
  const createProvisionedMember = useMutation(api.memberships.createProvisionedMember);
  const membershipDirectory = useQuery(
    api.memberships.listForActiveOrganization,
    !state.isDemo && authEnabled ? {} : 'skip'
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
  const [showCreateMember, setShowCreateMember] = useState(false);
  const [memberRole, setMemberRole] = useState<MemberRoleOption>('employee');
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberTeamId, setMemberTeamId] = useState('');
  const [memberSiteId, setMemberSiteId] = useState(state.onboarding.sites[0]?.id || '');
  const [memberError, setMemberError] = useState('');
  const [isSavingMember, setIsSavingMember] = useState(false);
  // Edit member state
  const [editMember, setEditMember] = useState<{ id: string; name: string; email: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [editSiteId, setEditSiteId] = useState('');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const updateMember = useMutation(api.memberships.updateMember);
  const removeMember = useMutation(api.memberships.removeMember);
  const reassignMember = useMutation(api.memberships.reassignMember);

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
  const teamOptions = teams.map((team) => ({
    label: team.name,
    value: team.id,
  }));

  const handleCreateMember = async () => {
    const trimmedName = memberName.trim();
    const normalizedEmail = memberEmail.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setMemberError('Enter a name with at least 2 characters.');
      return;
    }

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setMemberError('Enter a valid email address.');
      return;
    }

    if (!state.isDemo && memberPassword.length > 0 && memberPassword.length < 6) {
      setMemberError('Password must be at least 6 characters.');
      return;
    }

    if (memberRole === 'employee' && !memberTeamId && !isDirect) {
      setMemberError('Choose the team this employee belongs to.');
      return;
    }

    setMemberError('');
    setIsSavingMember(true);

    try {
      if (state.isDemo) {
        if (memberRole === 'subadmin' && !isDirect) {
          setMemberError('In demo mode, create a new lead with Add Team. Real accounts can provision subadmins directly.');
          return;
        }

        if (isDirect || !memberTeamId) {
          const nextEmployeeId = uid();
          if (memberTeamId) {
            // Direct mode with optional team assignment
            const selectedTeam = teams.find((team) => team.id === memberTeamId);
            if (selectedTeam) {
              const selectedSite = state.onboarding.sites.find((s) => s.id === memberSiteId);
              dispatch({
                type: 'ADD_MEMBER_TO_TEAM',
                teamId: selectedTeam.id,
                member: {
                  id: nextEmployeeId,
                  name: trimmedName,
                  role: 'employee',
                  teamId: selectedTeam.id,
                  teamName: selectedTeam.name,
                  siteId: memberSiteId || undefined,
                  siteName: selectedSite?.name,
                },
              });
            }
          } else {
            // Standalone employee — no team
            const selectedSite = state.onboarding.sites.find((s) => s.id === memberSiteId);
            dispatch({
              type: 'ADD_STANDALONE_EMPLOYEE',
              employee: {
                id: nextEmployeeId,
                name: trimmedName,
                role: 'employee',
                siteId: memberSiteId || undefined,
                siteName: selectedSite?.name,
              },
            });
          }
        } else {
          const selectedTeam = teams.find((team) => team.id === memberTeamId);
          if (!selectedTeam) {
            setMemberError('Select a valid team first.');
            return;
          }

          const nextEmployeeId = uid();
          dispatch({
            type: 'ADD_MEMBER_TO_TEAM',
            teamId: selectedTeam.id,
            member: {
              id: nextEmployeeId,
              name: trimmedName,
              role: 'employee',
              teamId: selectedTeam.id,
              teamName: selectedTeam.name,
            },
          });
        }
      } else {
        const selectedTeam = teams.find((team) => team.id === memberTeamId);
        const siteIds =
          memberRole === 'employee'
            ? [
                selectedTeam?.siteId || memberSiteId,
              ].filter(Boolean)
            : [memberSiteId].filter(Boolean);

        // In direct mode, teamIds can be empty for employees
        const teamIds = memberRole === 'employee' && memberTeamId
          ? [memberTeamId]
          : [];

        const result = await createProvisionedMember({
          name: trimmedName,
          email: normalizedEmail,
          role: memberRole,
          siteIds: siteIds as never,
          teamIds: teamIds as never,
        });

        // Create auth account so the person can sign in immediately
        if (memberPassword.length >= 6) {
          try {
            const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL || '';
            if (siteUrl) {
              await fetch(`${siteUrl}/admin/create-auth-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin' },
                body: JSON.stringify({ name: trimmedName, email: normalizedEmail, password: memberPassword }),
              });
            }
          } catch (e) {
            console.warn('Auth account creation failed — user can still be set up later.', e);
          }
        }

        if (memberRole === 'employee' && result?.user && selectedTeam) {
          dispatch({
            type: 'ADD_MEMBER_TO_TEAM',
            teamId: selectedTeam.id,
            member: {
              id: String(result.user._id),
              name: result.user.name,
              role: 'employee',
              teamId: selectedTeam.id,
              teamName: selectedTeam.name,
            },
          });
        }
      }

      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
      setMemberTeamId('');
      setMemberSiteId(state.onboarding.sites[0]?.id || '');
      setMemberRole('employee');
      setShowCreateMember(false);
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : 'We could not create that person yet.');
    } finally {
      setIsSavingMember(false);
    }
  };

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
            siteId: teamSiteId,
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
              siteId: createdTeam.siteId ? String(createdTeam.siteId) : teamSiteId,
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

  const handleEditMember = async () => {
    if (!editMember) return;

    const trimmedName = editName.trim();
    const normalizedEmail = editEmail.trim().toLowerCase();

    if (trimmedName.length > 0 && trimmedName.length < 2) {
      setEditError('Name must be at least 2 characters.');
      return;
    }

    if (normalizedEmail && !normalizedEmail.includes('@')) {
      setEditError('Enter a valid email address.');
      return;
    }

    if (editPassword.length > 0 && editPassword.length < 6) {
      setEditError('Password must be at least 6 characters.');
      return;
    }

    setEditError('');
    setIsSavingEdit(true);

    try {
      const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL || '';

      // Update name/email in Convex users table
      if (trimmedName || normalizedEmail) {
        await updateMember({
          userId: editMember.id as never,
          ...(trimmedName ? { name: trimmedName } : {}),
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
        });
      }

      // Update email in Better Auth if changed
      if (normalizedEmail && siteUrl) {
        // We need the old email — look it up from the directory
        const dirEntry = membershipDirectory?.find(
          (entry) => entry && String(entry.user._id) === editMember.id,
        );
        const oldEmail = dirEntry?.user?.email || '';
        if (oldEmail && oldEmail !== normalizedEmail) {
          await fetch(`${siteUrl}/admin/update-auth-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldEmail, newEmail: normalizedEmail }),
          });
        }
      }

      // Update password in Better Auth if provided
      if (editPassword.length >= 6 && siteUrl) {
        const dirEntry = membershipDirectory?.find(
          (entry) => entry && String(entry.user._id) === editMember.id,
        );
        const targetEmail = normalizedEmail || dirEntry?.user?.email || '';
        if (targetEmail) {
          await fetch(`${siteUrl}/admin/update-auth-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: targetEmail, newPassword: editPassword }),
          });
        }
      }

      // Reassign team/site if changed
      if (!state.isDemo) {
        await reassignMember({
          userId: editMember.id as never,
          teamIds: editTeamId ? [editTeamId as never] : [],
          siteIds: editSiteId ? [editSiteId as never] : [],
        });
      } else {
        const selectedSite = state.onboarding.sites.find((s) => s.id === editSiteId);
        dispatch({
          type: 'REASSIGN_EMPLOYEE',
          employeeId: editMember.id,
          newTeamId: editTeamId || undefined,
          siteId: editSiteId || undefined,
          siteName: selectedSite?.name,
        });
      }

      setEditMember(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to save changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <RoleSwitcher />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4">
          <View className="flex-row items-center justify-between gap-3 mb-3">
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex-1">
              {isDirect ? 'People' : 'Teams'}
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setShowCreateMember(true)}
                className="flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
              >
                <Ionicons name="person-add" size={16} color={color} />
                <Text className="text-xs font-semibold" style={{ color }}>
                  Add Person
                </Text>
              </Pressable>
              {!isDirect && (
                <Pressable
                  onPress={() => setShowCreateTeam(true)}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                >
                  <Ionicons name="add" size={16} color={color} />
                  <Text className="text-xs font-semibold" style={{ color }}>
                    Add Team
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* ── Direct mode: flat employee list ── */}
          {isDirect && allEmployees.length === 0 && (
            <EmptyState
              icon="people-outline"
              title="No people yet"
              subtitle="Add your first employee to get started."
            />
          )}

          {isDirect && allEmployees.length > 0 && (
            <Card>
              {allEmployees.map((emp, idx) => {
                const summary = summaries.get(emp.id) || {
                  activeCount: 0,
                  overdueCount: 0,
                  lastActivity: null,
                  checkedInToday: false,
                };
                const perf = allPerfs.get(emp.id);
                const activeAvail = getActiveAvailability(emp.id, today, availability);
                const availBadge = activeAvail
                  ? {
                      label: activeAvail.type === 'sick' ? 'Sick' : activeAvail.type === 'leave' ? 'On leave' : 'Off duty',
                      color: activeAvail.type === 'sick' ? '#ef4444' : activeAvail.type === 'leave' ? '#3b82f6' : '#6366f1',
                    }
                  : null;
                return (
                  <EmployeeSummaryCard
                    key={emp.id}
                    name={emp.name}
                    teamColor={color}
                    summary={summary}
                    isLead={false}
                    last={idx === allEmployees.length - 1}
                    score={perf?.score}
                    band={perf?.band}
                    topAction={perf?.actions[0]?.label}
                    siteName={emp.siteName}
                    availabilityBadge={availBadge}
                    onPress={() => {
                      setEditMember({ id: emp.id, name: emp.name, email: '' });
                      setEditName(emp.name);
                      setEditEmail('');
                      setEditPassword('');
                      setEditTeamId(emp.teamId || '');
                      setEditSiteId(emp.siteId || '');
                      setEditError('');
                    }}
                  />
                );
              })}
            </Card>
          )}

          {/* ── Managed mode: team-grouped view ── */}
          {!isDirect && teams.length === 0 && (
            <EmptyState
              icon="people-outline"
              title="No teams yet"
              subtitle="Create a subadmin to get started."
            />
          )}

          {!isDirect && teams.map((team) => {
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
                      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {team.name}
                      </Text>
                      <Text className="text-xs text-gray-400 dark:text-gray-500">
                        {allMembers.length} {allMembers.length === 1 ? 'person' : 'people'} · {teamActiveCount} active
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
                      color={isDark ? '#6b7280' : '#9ca3af'}
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
                          onPress={!state.isDemo ? () => {
                            setEditMember({ id: member.id, name: member.name, email: '' });
                            setEditName(member.name);
                            setEditEmail('');
                            setEditPassword('');
                            setEditError('');
                          } : undefined}
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

      <Modal visible={showCreateMember} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/30" onPress={() => setShowCreateMember(false)} />
        <View className="bg-white dark:bg-gray-950 rounded-t-3xl px-5 pt-5 pb-10">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Add Person</Text>
            <Pressable onPress={() => setShowCreateMember(false)}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </Pressable>
          </View>

          {!isDirect && (
            <Select
              label="Role"
              placeholder="Choose a role"
              options={[
                { label: 'Employee', value: 'employee' },
                ...(!state.isDemo ? [{ label: 'Subadmin', value: 'subadmin' }] : []),
              ]}
              value={memberRole}
              onChange={(value) => {
                setMemberRole(value as MemberRoleOption);
                setMemberError('');
              }}
            />
          )}

          <View className="mt-4">
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Full Name
            </Text>
            <TextInput
              className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 mb-4"
              placeholder="Ada Nwobi"
              value={memberName}
              onChangeText={(text) => {
                setMemberName(text);
                setMemberError('');
              }}
              placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
            />

            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Work Email
            </Text>
            <TextInput
              className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 mb-4"
              placeholder="ada@company.com"
              value={memberEmail}
              onChangeText={(text) => {
                setMemberEmail(text);
                setMemberError('');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
            />

            {!state.isDemo && (
              <>
                <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Password
                </Text>
                <TextInput
                  className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100"
                  placeholder="Min. 6 characters"
                  value={memberPassword}
                  onChangeText={(text) => {
                    setMemberPassword(text);
                    setMemberError('');
                  }}
                  secureTextEntry
                  placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
                />
              </>
            )}
          </View>

          {/* In direct mode, team/site selection is optional */}
          {isDirect ? (
            <>
              {teamOptions.length > 0 && (
                <View className="mt-4">
                  <Select
                    label="Team (optional)"
                    placeholder="No team"
                    options={[{ label: 'No team', value: '' }, ...teamOptions]}
                    value={memberTeamId}
                    onChange={(value) => {
                      setMemberTeamId(value);
                      setMemberError('');
                    }}
                  />
                </View>
              )}
              {state.onboarding.sites.length > 0 && (
                <View className="mt-4">
                  <Select
                    label="Site (optional)"
                    placeholder="No site"
                    options={[{ label: 'No site', value: '' }, ...state.onboarding.sites.map((site) => ({ label: site.name, value: site.id }))]}
                    value={memberSiteId}
                    onChange={(value) => {
                      setMemberSiteId(value);
                      setMemberError('');
                    }}
                  />
                </View>
              )}
            </>
          ) : (
            <View className="mt-4">
              <Select
                label={memberRole === 'employee' ? 'Team' : 'Primary Site'}
                placeholder={
                  memberRole === 'employee'
                    ? teamOptions.length > 0
                      ? 'Choose a team'
                      : 'Create a team first'
                    : 'Choose a site'
                }
                options={
                  memberRole === 'employee'
                    ? teamOptions
                    : state.onboarding.sites.map((site) => ({
                        label: site.name,
                        value: site.id,
                      }))
                }
                value={memberRole === 'employee' ? memberTeamId : memberSiteId}
                onChange={(value) => {
                  if (memberRole === 'employee') {
                    setMemberTeamId(value);
                  } else {
                    setMemberSiteId(value);
                  }
                  setMemberError('');
                }}
              />
            </View>
          )}

          <Text className="text-sm text-gray-400 dark:text-gray-500 leading-6 mt-5">
            {state.isDemo
              ? (isDirect
                ? 'This employee will report directly to you.'
                : memberRole === 'employee'
                  ? 'Employees are attached to a team immediately.'
                  : 'Subadmins become team leads right away.')
              : 'Set a password so this person can sign in immediately — no email confirmation needed.'}
          </Text>

          {memberError ? (
            <Text className="text-sm text-red-600 mt-4">{memberError}</Text>
          ) : null}

          <View className="mt-5">
            <Button
              title={isSavingMember ? 'Creating person...' : 'Create Person'}
              onPress={() => void handleCreateMember()}
              disabled={isSavingMember || (!isDirect && memberRole === 'employee' && teamOptions.length === 0)}
              color={color}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateTeam} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/30" onPress={() => setShowCreateTeam(false)} />
        <View className="bg-white dark:bg-gray-950 rounded-t-3xl px-5 pt-5 pb-10">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Add Team</Text>
            <Pressable onPress={() => setShowCreateTeam(false)}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </Pressable>
          </View>

          <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Team Name
          </Text>
          <TextInput
            className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 mb-4"
            placeholder="Operations North"
            value={teamName}
            onChangeText={(text) => {
              setTeamName(text);
              setTeamError('');
            }}
            placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
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
                <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Lead Name
                </Text>
                <TextInput
                  className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100"
                  placeholder="Enter a lead name"
                  value={demoLeadName}
                  onChangeText={(text) => {
                    setDemoLeadName(text);
                    setTeamError('');
                  }}
                  placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
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
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Team Color
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {['#6366f1', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'].map((swatch) => {
                const selected = teamColor === swatch;
                return (
                  <Pressable
                    key={swatch}
                    onPress={() => setTeamColor(swatch)}
                    className={`w-10 h-10 rounded-full items-center justify-center ${selected ? 'border-2 border-gray-900 dark:border-gray-100' : ''}`}
                    style={{ backgroundColor: swatch }}
                  >
                    {selected ? <Ionicons name="checkmark" size={16} color="white" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {!state.isDemo && !canCreateRealTeam ? (
            <Text className="text-sm text-gray-400 dark:text-gray-500 leading-6 mt-5">
              This org does not have any available subadmins yet. Create or invite a subadmin first, then you can attach that lead to a new team.
            </Text>
          ) : (
            <Text className="text-sm text-gray-400 dark:text-gray-500 leading-6 mt-5">
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

      {/* ── Edit Person Modal ── */}
      <Modal visible={!!editMember} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/30" onPress={() => setEditMember(null)} />
        <View className="bg-white dark:bg-gray-950 rounded-t-3xl px-5 pt-5 pb-10">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-base font-bold text-gray-900 dark:text-gray-100">Edit Person</Text>
            <Pressable onPress={() => setEditMember(null)}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </Pressable>
          </View>

          <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Full Name
          </Text>
          <TextInput
            className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 mb-4"
            placeholder="Full name"
            value={editName}
            onChangeText={(text) => { setEditName(text); setEditError(''); }}
            placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
          />

          <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Email
          </Text>
          <TextInput
            className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 mb-4"
            placeholder="New email (leave empty to keep current)"
            value={editEmail}
            onChangeText={(text) => { setEditEmail(text); setEditError(''); }}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
          />

          <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            New Password
          </Text>
          <TextInput
            className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100"
            placeholder="Leave empty to keep current"
            value={editPassword}
            onChangeText={(text) => { setEditPassword(text); setEditError(''); }}
            secureTextEntry
            placeholderTextColor={isDark ? '#6b7280' : '#d1d5db'}
          />

          {/* Team reassignment */}
          {teamOptions.length > 0 && (
            <View className="mt-4">
              <Select
                label="Team"
                placeholder="No team"
                options={[{ label: 'No team', value: '' }, ...teamOptions]}
                value={editTeamId}
                onChange={(value) => { setEditTeamId(value); setEditError(''); }}
              />
            </View>
          )}

          {/* Site reassignment */}
          {state.onboarding.sites.length > 0 && (
            <View className="mt-4">
              <Select
                label="Site"
                placeholder="No site"
                options={[{ label: 'No site', value: '' }, ...state.onboarding.sites.map((s) => ({ label: s.name, value: s.id }))]}
                value={editSiteId}
                onChange={(value) => { setEditSiteId(value); setEditError(''); }}
              />
            </View>
          )}

          <Text className="text-sm text-gray-400 dark:text-gray-500 leading-6 mt-4">
            Only fill in the fields you want to change.
          </Text>

          {editError ? (
            <Text className="text-sm text-red-600 mt-3">{editError}</Text>
          ) : null}

          <View className="mt-5 gap-3">
            <Button
              title={isSavingEdit ? 'Saving...' : 'Save Changes'}
              onPress={() => void handleEditMember()}
              disabled={isSavingEdit}
              color={color}
            />
            <Pressable
              onPress={() => {
                if (!editMember) return;
                const doRemove = async () => {
                  setIsSavingEdit(true);
                  try {
                    await removeMember({ userId: editMember.id as never });
                    setEditMember(null);
                  } catch (e) {
                    setEditError(e instanceof Error ? e.message : 'Failed to remove person.');
                  } finally {
                    setIsSavingEdit(false);
                  }
                };
                if (Platform.OS === 'web') {
                  if (window.confirm(`Remove ${editMember.name} from this organization?`)) {
                    void doRemove();
                  }
                } else {
                  Alert.alert(
                    'Remove Person',
                    `Are you sure you want to remove ${editMember.name} from this organization?`,
                    [
                      { text: 'Cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => void doRemove() },
                    ],
                  );
                }
              }}
              disabled={isSavingEdit}
              className="py-3 items-center"
            >
              <Text className="text-sm font-semibold text-red-500">Remove Person</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
