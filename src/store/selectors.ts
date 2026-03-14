import { useMemo } from 'react';
import { useApp } from './AppContext';
import { computeCounters, scopeTasksForRole, isStalledTask, consecutiveNoChangeWorkdays } from '../utils/task-helpers';
import { computeCheckInStats, type CheckInStats } from '../utils/checkin-helpers';
import { computeEmployeePerformance, computeSubadminPerformance } from '../utils/performance';
import { getHandoffProgress } from '../utils/handoff-helpers';
import { isOverdue, getToday } from '../utils/date';
import {
  isProtectedUnavailable,
  awayTodayForScope,
  pendingAvailabilityRequestsForScope,
  coverageNeededTasksForScope,
} from '../utils/availability-helpers';
import type { Task, Team, Employee, CheckIn, EmployeePerformance, SubadminPerformance, AvailabilityRecord, OrgMode } from '../types';

// ── Teams & Employees (from state, org-scoped) ──────────────────────

export function useOrgMode(): OrgMode {
  const { state } = useApp();
  return state.orgMode;
}

export function useTeams(): Team[] {
  const { state } = useApp();
  return state.teams;
}

export function useAllEmployees(): Employee[] {
  const { state } = useApp();
  return state.allEmployees;
}

export function useCurrentUser(): Employee | null {
  const { state } = useApp();
  if (state.role === 'admin') return null;
  return state.allEmployees.find((e) => e.id === state.userId) || null;
}

export function useCurrentName(): string {
  const { state } = useApp();
  if (state.role === 'admin') return state.onboarding.adminName || 'Admin';
  const user = state.allEmployees.find((e) => e.id === state.userId);
  return user?.name || 'User';
}

export function useCurrentRoleLabel(): string {
  const { state } = useApp();
  if (state.role === 'admin') return 'Owner';
  if (state.role === 'subadmin') return 'SubAdmin';
  return 'Employee';
}

export function useMyTeam() {
  const { state } = useApp();
  // In direct mode, employees may not belong to any team
  if (state.orgMode === 'direct') return undefined;
  return state.teams.find((t) =>
    t.lead.id === state.userId ||
    t.members.some((m) => m.id === state.userId)
  );
}

export function useTeamMemberIds(): string[] {
  const team = useMyTeam();
  if (!team) return [];
  return [team.lead.id, ...team.members.map((m) => m.id)];
}

export function useScopedTasks(): Task[] {
  const { state } = useApp();
  const memberIds = useTeamMemberIds();
  return useMemo(
    () => scopeTasksForRole(state.tasks, state.userId, state.role, memberIds),
    [state.tasks, state.userId, state.role, memberIds]
  );
}

export function useMyAssignedTasks(): Task[] {
  const { state } = useApp();
  const name = useCurrentName();
  return useMemo(
    () => state.tasks.filter((t) => t.assignedBy === name),
    [state.tasks, name]
  );
}

export function useDashboardCounters() {
  const { state } = useApp();
  const memberIds = useTeamMemberIds();
  return useMemo(
    () => computeCounters(state.tasks, state.userId, state.role, memberIds),
    [state.tasks, state.userId, state.role, memberIds]
  );
}

export function useTaskAudit(taskId: string) {
  const { state } = useApp();
  return useMemo(
    () => state.audit.filter((a) => a.taskId === taskId).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
    [state.audit, taskId]
  );
}

export function useIndustryColor(): string {
  const { state } = useApp();
  return state.onboarding.industry?.color || '#059669';
}

export function useSitesLabel(): string {
  const { state } = useApp();
  return state.onboarding.industry?.sitesLabel || 'Sites';
}

export function useMyCheckIns(): CheckIn[] {
  const { state } = useApp();
  return useMemo(
    () =>
      state.checkIns
        .filter((c) => c.userId === state.userId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [state.checkIns, state.userId]
  );
}

export function useCheckInStats(year?: number, month?: number): CheckInStats {
  const { state } = useApp();
  return useMemo(
    () => computeCheckInStats(state.checkIns, state.userId || '', year, month),
    [state.checkIns, state.userId, year, month]
  );
}

// ── New selectors for SaaS ops workspace ──────────────────────────────

export function useBucketedTasks() {
  const scoped = useScopedTasks();
  return useMemo(() => {
    const active = scoped.filter((t) => t.status === 'Open' || t.status === 'In Progress');
    const review = scoped.filter((t) => t.status === 'Pending Approval' || t.status === 'Completed');
    const done = scoped.filter((t) => t.status === 'Verified');
    return { active, review, done };
  }, [scoped]);
}

export function useActiveGroups() {
  const { active } = useBucketedTasks();
  const { state } = useApp();
  return useMemo(() => {
    const threshold = state.orgSettings.noChangeAlertWorkdays;
    const overdue = active.filter((t) => isOverdue(t.due, t.status));
    const stalled = active.filter(
      (t) => !isOverdue(t.due, t.status) && isStalledTask(t, state.audit, threshold, state.availability)
    );
    const stalledIds = new Set(stalled.map((t) => t.id));
    const reworked = active.filter(
      (t) => t.reworked && !isOverdue(t.due, t.status) && !stalledIds.has(t.id)
    );
    const inProgress = active.filter(
      (t) => t.status === 'In Progress' && !t.reworked && !isOverdue(t.due, t.status) && !stalledIds.has(t.id)
    );
    const unstarted = active.filter(
      (t) => t.status === 'Open' && !t.reworked && !isOverdue(t.due, t.status) && !stalledIds.has(t.id)
    );
    return { overdue, stalled, reworked, inProgress, unstarted };
  }, [active, state.audit, state.orgSettings.noChangeAlertWorkdays, state.availability]);
}

export function useSiteTasks(siteId: string): Task[] {
  const { state } = useApp();
  return useMemo(
    () => state.tasks.filter((t) => t.siteId === siteId),
    [state.tasks, siteId]
  );
}

export interface SiteHealth {
  totalActive: number;
  overdue: number;
  review: number;
  checkInRate: number;
}

export function useSiteHealth(siteId: string): SiteHealth {
  const { state } = useApp();
  return useMemo(() => {
    const siteTasks = state.tasks.filter((t) => t.siteId === siteId);
    const totalActive = siteTasks.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;
    const overdue = siteTasks.filter((t) => isOverdue(t.due, t.status)).length;
    const review = siteTasks.filter((t) => t.status === 'Pending Approval' || t.status === 'Completed').length;

    // Check-in rate: unique employees at this site who checked in today
    const today = getToday();
    const siteEmpIds = [...new Set(siteTasks.map((t) => t.assigneeId))];
    const checkedIn = siteEmpIds.filter((eid) =>
      state.checkIns.some((c) => c.userId === eid && c.date === today && c.status === 'Checked-In')
    ).length;
    const checkInRate = siteEmpIds.length > 0 ? Math.round((checkedIn / siteEmpIds.length) * 100) : 0;

    return { totalActive, overdue, review, checkInRate };
  }, [state.tasks, state.checkIns, siteId]);
}

export interface TeamHealth {
  totalActive: number;
  overdue: number;
  review: number;
  completedThisWeek: number;
}

export function useTeamHealth(teamId: string): TeamHealth {
  const { state } = useApp();
  return useMemo(() => {
    const teamTasks = state.tasks.filter((t) => t.teamId === teamId);
    const totalActive = teamTasks.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;
    const overdue = teamTasks.filter((t) => isOverdue(t.due, t.status)).length;
    const review = teamTasks.filter((t) => t.status === 'Pending Approval' || t.status === 'Completed').length;

    // Completed this week
    const today = new Date(getToday() + 'T00:00:00');
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const weekStart = monday.toISOString().split('T')[0];

    const completedThisWeek = teamTasks.filter(
      (t) => (t.status === 'Completed' || t.status === 'Verified') && t.completedAt && t.completedAt >= weekStart
    ).length;

    return { totalActive, overdue, review, completedThisWeek };
  }, [state.tasks, teamId]);
}

export interface EmployeeSummary {
  activeCount: number;
  overdueCount: number;
  lastActivity: string | null;
  checkedInToday: boolean;
}

export function useEmployeeSummaries(): Map<string, EmployeeSummary> {
  const { state } = useApp();
  return useMemo(() => {
    const today = getToday();
    const map = new Map<string, EmployeeSummary>();

    for (const emp of state.allEmployees) {
      const empTasks = state.tasks.filter((t) => t.assigneeId === emp.id);
      const activeCount = empTasks.filter((t) => t.status === 'Open' || t.status === 'In Progress').length;
      const overdueCount = empTasks.filter((t) => isOverdue(t.due, t.status)).length;

      // Most recent lastActivityAt across tasks, or most recent check-in
      const taskDates = empTasks
        .map((t) => t.lastActivityAt || t.createdAt)
        .sort((a, b) => b.localeCompare(a));
      const checkInDates = state.checkIns
        .filter((c) => c.userId === emp.id && c.status === 'Checked-In')
        .map((c) => c.date)
        .sort((a, b) => b.localeCompare(a));

      const candidates = [...taskDates.slice(0, 1), ...checkInDates.slice(0, 1)].sort((a, b) => b.localeCompare(a));
      const lastActivity = candidates[0] || null;

      const checkedInToday = state.checkIns.some(
        (c) => c.userId === emp.id && c.date === today && c.status === 'Checked-In'
      );

      map.set(emp.id, { activeCount, overdueCount, lastActivity, checkedInToday });
    }

    return map;
  }, [state.tasks, state.checkIns, state.allEmployees]);
}

export function useMyDayData() {
  const { state } = useApp();
  return useMemo(() => {
    const today = getToday();
    const myTasks = state.tasks.filter((t) => t.assigneeId === state.userId);
    const dueToday = myTasks.filter(
      (t) => t.due === today && (t.status === 'Open' || t.status === 'In Progress')
    );
    const overdue = myTasks.filter((t) => isOverdue(t.due, t.status));
    const inProgress = myTasks.filter(
      (t) => t.status === 'In Progress' && !isOverdue(t.due, t.status)
    );
    const checkedInToday = state.checkIns.some(
      (c) => c.userId === state.userId && c.date === today && c.status === 'Checked-In'
    );

    return { dueToday, overdue, inProgress, checkedInToday };
  }, [state.tasks, state.checkIns, state.userId]);
}

export function useCheckInHealth(employeeIds: string[]) {
  const { state } = useApp();
  return useMemo(() => {
    const today = getToday();
    const total = employeeIds.length;
    const checkedInToday = employeeIds.filter((eid) =>
      state.checkIns.some((c) => c.userId === eid && c.date === today && c.status === 'Checked-In')
    ).length;
    const rate = total > 0 ? Math.round((checkedInToday / total) * 100) : 0;
    return { checkedInToday, total, rate };
  }, [state.checkIns, employeeIds]);
}

// ── Performance / Accountability selectors ───────────────────────────

export function useEmployeePerformance(employeeId: string): EmployeePerformance {
  const { state } = useApp();
  return useMemo(
    () => computeEmployeePerformance(employeeId, state.tasks, state.checkIns, state.teams, state.availability, state.orgMode),
    [employeeId, state.tasks, state.checkIns, state.teams, state.availability, state.orgMode]
  );
}

export function useAllEmployeePerformances(): Map<string, EmployeePerformance> {
  const { state } = useApp();
  return useMemo(() => {
    const map = new Map<string, EmployeePerformance>();
    for (const emp of state.allEmployees) {
      map.set(emp.id, computeEmployeePerformance(emp.id, state.tasks, state.checkIns, state.teams, state.availability, state.orgMode));
    }
    return map;
  }, [state.tasks, state.checkIns, state.allEmployees, state.teams, state.availability, state.orgMode]);
}

export function useSubadminPerformance(teamId: string): SubadminPerformance {
  const { state } = useApp();
  return useMemo(
    () => computeSubadminPerformance(teamId, state.tasks, state.checkIns, state.teams, state.availability, state.orgMode),
    [teamId, state.tasks, state.checkIns, state.teams, state.availability, state.orgMode]
  );
}

export function useAtRiskEmployees(limit?: number): EmployeePerformance[] {
  const allPerfs = useAllEmployeePerformances();
  return useMemo(() => {
    const atRisk = Array.from(allPerfs.values())
      .filter((p) => p.band !== 'green')
      .sort((a, b) => a.score - b.score);
    return limit ? atRisk.slice(0, limit) : atRisk;
  }, [allPerfs, limit]);
}

export function useMyPerformance(): EmployeePerformance | null {
  const { state } = useApp();
  return useMemo(() => {
    if (state.role === 'admin' || !state.userId) return null;
    return computeEmployeePerformance(state.userId, state.tasks, state.checkIns, state.teams, state.availability, state.orgMode);
  }, [state.role, state.userId, state.tasks, state.checkIns, state.teams, state.availability, state.orgMode]);
}

// ── Daily Handoff & Delegation selectors ────────────────────────────

export function useStalledDays(taskId: string): number {
  const { state } = useApp();
  return useMemo(() => {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return 0;
    return consecutiveNoChangeWorkdays(task.id, task.assigneeId, state.audit, getToday(), state.availability);
  }, [state.tasks, state.audit, state.availability, taskId]);
}

export function useHandoffProgress() {
  const { state } = useApp();
  return useMemo(
    () => getHandoffProgress(state.tasks, state.userId || '', state.audit),
    [state.tasks, state.userId, state.audit]
  );
}

export function useHasCompletedHandoffToday(): boolean {
  const { state } = useApp();
  return useMemo(() => {
    const today = getToday();
    return state.handoffs.some(
      (h) => h.userId === state.userId && h.date === today
    );
  }, [state.handoffs, state.userId]);
}

export function useNeedsDelegation(): Task[] {
  const { state } = useApp();
  return useMemo(() => {
    if (state.role !== 'subadmin' || !state.userId) return [];
    return state.tasks.filter(
      (t) =>
        t.accountableLeadId === state.userId &&
        t.assigneeId === state.userId &&
        !t.delegatedAt &&
        (t.status === 'Open' || t.status === 'In Progress')
    );
  }, [state.tasks, state.userId, state.role]);
}

// ── Availability selectors ──────────────────────────────────────────

export function useAvailability(): AvailabilityRecord[] {
  const { state } = useApp();
  return state.availability;
}

export function useIsProtectedUnavailableToday(): boolean {
  const { state } = useApp();
  return useMemo(() => {
    if (!state.userId) return false;
    return isProtectedUnavailable(state.userId, getToday(), state.availability);
  }, [state.userId, state.availability]);
}

export function useAwayToday(): Employee[] {
  const { state } = useApp();
  return useMemo(
    () => awayTodayForScope(state.userId, getToday(), state.availability, state.teams, state.allEmployees, state.role),
    [state.userId, state.availability, state.teams, state.allEmployees, state.role]
  );
}

export function usePendingRequests(): AvailabilityRecord[] {
  const { state } = useApp();
  return useMemo(
    () => pendingAvailabilityRequestsForScope(state.userId, state.availability, state.teams, state.role),
    [state.userId, state.availability, state.teams, state.role]
  );
}

export function useCoverageNeeded(): Task[] {
  const { state } = useApp();
  return useMemo(
    () => coverageNeededTasksForScope(state.userId, getToday(), state.tasks, state.availability, state.teams, state.role),
    [state.userId, state.tasks, state.availability, state.teams, state.role]
  );
}
