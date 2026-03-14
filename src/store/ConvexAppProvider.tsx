import React, { createContext, useContext, useCallback, useMemo, useState, useEffect, type ReactNode } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { AppContext, type AppState, type AppAction } from './AppContext';
import type {
  Task,
  AuditEntry,
  CheckIn,
  Team,
  Employee,
  Category,
  HandoffRecord,
  AvailabilityRecord,
  Account,
  Role,
  Industry,
} from '../types';
import { uid } from '../utils/id';
import { getNowISO, getToday } from '../utils/date';

// Uses the shared AppContext so useApp() works for both providers

// ── Provider ────────────────────────────────────────────────────────

export function ConvexAppProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerkAuth();

  // Local UI state (role switching, active org)
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [viewRole, setViewRole] = useState<Role>('admin');
  const [viewUserId, setViewUserId] = useState<string | null>(null);

  // ── Sync Clerk user to Convex ───────────────────────────────────
  const syncUser = useMutation(api.users.syncUser);
  const convexUser = useQuery(api.users.me);

  useEffect(() => {
    if (clerkUser && isUserLoaded) {
      syncUser({
        clerkId: clerkUser.id,
        name: clerkUser.fullName || clerkUser.firstName || 'User',
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        imageUrl: clerkUser.imageUrl,
      }).catch(() => {
        // Sync failed, will retry on next render
      });
    }
  }, [clerkUser?.id, isUserLoaded]);

  // ── Fetch orgs ──────────────────────────────────────────────────
  const myOrgs = useQuery(api.organizations.listMine) || [];

  // Set first org as active if none selected
  useEffect(() => {
    if (myOrgs.length > 0 && !activeOrgId) {
      setActiveOrgId(myOrgs[0]!._id);
    }
  }, [myOrgs, activeOrgId]);

  const activeOrg = myOrgs.find((o: any) => o._id === activeOrgId) || myOrgs[0];
  const activeOrgIdResolved = activeOrg?._id || null;

  // ── Fetch org data (skip if no org) ─────────────────────────────
  const tasks = useQuery(
    api.tasks.listByOrg,
    activeOrgIdResolved ? { orgId: activeOrgIdResolved } : 'skip'
  ) || [];

  const audit = useQuery(
    api.auditTrail.listByOrg,
    activeOrgIdResolved ? { orgId: activeOrgIdResolved } : 'skip'
  ) || [];

  const checkIns = useQuery(
    api.checkIns.listByOrg,
    activeOrgIdResolved ? { orgId: activeOrgIdResolved } : 'skip'
  ) || [];

  const handoffs = useQuery(
    api.handoffs.listByOrg,
    activeOrgIdResolved ? { orgId: activeOrgIdResolved } : 'skip'
  ) || [];

  const availabilityRaw = useQuery(
    api.availability.listByOrg,
    activeOrgIdResolved ? { orgId: activeOrgIdResolved } : 'skip'
  ) || [];

  const teamsRaw = useQuery(
    api.teams.listByOrg,
    activeOrgIdResolved ? { orgId: activeOrgIdResolved } : 'skip'
  ) || [];

  const categories = useQuery(
    api.categories.listByOrg,
    activeOrgIdResolved ? { orgId: activeOrgIdResolved } : 'skip'
  ) || [];

  const sites = useQuery(
    api.sites.listByOrg,
    activeOrgIdResolved ? { orgId: activeOrgIdResolved } : 'skip'
  ) || [];

  // ── Mutations ───────────────────────────────────────────────────
  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const reworkTask = useMutation(api.tasks.rework);
  const createAudit = useMutation(api.auditTrail.create);
  const createCheckIn = useMutation(api.checkIns.create);
  const createHandoff = useMutation(api.handoffs.create);
  const requestAvailability = useMutation(api.availability.request);
  const approveAvailability = useMutation(api.availability.approve);
  const rejectAvailability = useMutation(api.availability.reject);
  const cancelAvailability = useMutation(api.availability.cancel);
  const createOrg = useMutation(api.organizations.create);
  const updateOrgSettings = useMutation(api.organizations.updateSettings);
  const batchSetCategories = useMutation(api.categories.batchSet);

  // ── Map Convex data → AppState shape ────────────────────────────
  const mappedTasks: Task[] = useMemo(() =>
    tasks.map((t: any) => ({
      id: t._id,
      title: t.title,
      site: '', // TODO: resolve site name
      siteId: t.siteId || '',
      category: t.categoryId || '',
      priority: t.priority,
      due: t.due,
      assignee: '', // TODO: resolve assignee name
      assigneeId: t.assigneeId,
      teamId: '',
      status: t.status === 'Not Started' ? 'Open' : t.status,
      assignedBy: '',
      assignedByRole: 'admin' as Role,
      note: t.description,
      approved: t.status === 'Verified',
      createdAt: t.createdAt,
      startedAt: undefined,
      completedAt: t.completedAt,
      verifiedBy: t.verifiedBy,
      reworked: t.reworked,
      reworkCount: t.reworkCount,
      accountableLeadId: t.accountableLeadId,
      delegatedAt: t.delegatedAt,
    })),
    [tasks]
  );

  const mappedAudit: AuditEntry[] = useMemo(() =>
    audit.map((a: any) => ({
      id: a._id,
      taskId: a.taskId || null,
      role: a.role,
      message: a.message,
      createdAt: a.createdAt,
      dateTag: a.dateTag,
      updateType: a.updateType,
    })),
    [audit]
  );

  const mappedCheckIns: CheckIn[] = useMemo(() =>
    checkIns.map((c: any) => ({
      userId: c.userId,
      date: c.date,
      status: 'Checked-In' as const,
      type: null,
      checkedInAt: c.time,
      summary: c.note || null,
    })),
    [checkIns]
  );

  const mappedHandoffs: HandoffRecord[] = useMemo(() =>
    handoffs.map((h: any) => ({
      userId: h.userId,
      date: h.date,
      completedAt: h.createdAt,
      tasksSummary: h.tasks.map((t: any) => ({
        taskId: t.taskId,
        action: t.note ? 'update' as const : 'noChange' as const,
      })),
      type: h.tasks.length > 0 ? 'tasks_reviewed' as const : 'no_tasks' as const,
    })),
    [handoffs]
  );

  const mappedAvailability: AvailabilityRecord[] = useMemo(() =>
    availabilityRaw.map((a: any) => ({
      id: a._id,
      organizationId: a.orgId,
      memberId: a.userId,
      type: a.type,
      status: a.status,
      startDate: a.startDate,
      endDate: a.endDate,
      notes: a.reason || '',
      requestedById: a.userId,
      approvedById: a.approvedById || null,
      createdAt: a.createdAt,
      approvedAt: a.approvedAt || null,
    })),
    [availabilityRaw]
  );

  const mappedTeams: Team[] = useMemo(() =>
    teamsRaw.map((t: any) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      lead: t.lead,
      members: t.members,
    })),
    [teamsRaw]
  );

  const allEmployees: Employee[] = useMemo(() =>
    mappedTeams.flatMap((t) => [t.lead, ...t.members]),
    [mappedTeams]
  );

  const mappedCategories: Category[] = useMemo(() =>
    categories.map((c: any) => ({ id: c._id, name: c.name })),
    [categories]
  );

  // ── Build AppState ──────────────────────────────────────────────
  const state: AppState = useMemo(() => ({
    onboardingComplete: !!activeOrg,
    onboarding: {
      orgName: activeOrg?.name || '',
      industry: activeOrg?.industry || null,
      adminName: convexUser?.name || clerkUser?.fullName || '',
      sites: sites.map((s: any) => ({ id: s._id, name: s.name })),
    },
    role: viewRole,
    userId: viewUserId || (convexUser?._id as string) || null,
    tasks: mappedTasks,
    audit: mappedAudit,
    checkIns: mappedCheckIns,
    categories: mappedCategories,
    orgSettings: activeOrg?.settings || { noChangeAlertWorkdays: 3, reworkAlertCycles: 3 },
    handoffs: mappedHandoffs,
    availability: mappedAvailability,
    teams: mappedTeams,
    allEmployees,
    workspaces: myOrgs.map((o: any) => ({
      id: o._id,
      orgName: o.name,
      industry: o.industry,
    })),
    activeWorkspaceId: activeOrgIdResolved || '',
    isAuthenticated: !!clerkUser,
    currentAccountId: convexUser?._id as string || null,
    currentAccountName: convexUser?.name || null,
    isDemo: false,
  }), [
    activeOrg, convexUser, clerkUser, viewRole, viewUserId,
    mappedTasks, mappedAudit, mappedCheckIns, mappedCategories,
    mappedHandoffs, mappedAvailability, mappedTeams, allEmployees,
    sites, myOrgs, activeOrgIdResolved,
  ]);

  // ── Dispatch → Convex mutations ─────────────────────────────────
  const dispatch = useCallback((action: AppAction) => {
    if (!activeOrgIdResolved) return;

    switch (action.type) {
      case 'SWITCH_USER':
        setViewRole(action.role);
        setViewUserId(action.userId);
        break;

      case 'SWITCH_ORGANIZATION':
        setActiveOrgId(action.workspaceId);
        setViewRole('admin');
        setViewUserId(null);
        break;

      case 'SIGN_OUT':
        signOut();
        break;

      case 'ADD_TASK':
        createTask({
          orgId: activeOrgIdResolved as any,
          title: action.task.title,
          description: action.task.note,
          priority: action.task.priority as any,
          categoryId: action.task.category,
          siteId: action.task.siteId,
          assigneeId: action.task.assigneeId,
          accountableLeadId: action.task.accountableLeadId,
          due: action.task.due || getToday(),
        });
        break;

      case 'UPDATE_TASK':
        updateTask({
          taskId: action.taskId as any,
          updates: action.updates as any,
        });
        break;

      case 'REWORK_TASK':
        reworkTask({
          taskId: action.taskId as any,
          reason: action.reason,
        });
        break;

      case 'ADD_AUDIT':
        createAudit({
          orgId: activeOrgIdResolved as any,
          taskId: action.entry.taskId || undefined,
          role: action.entry.role,
          message: action.entry.message,
          updateType: action.entry.updateType,
        });
        break;

      case 'ADD_CHECKIN':
        createCheckIn({
          orgId: activeOrgIdResolved as any,
          userId: action.checkIn.userId,
          date: action.checkIn.date,
          time: action.checkIn.checkedInAt || getNowISO(),
          note: action.checkIn.summary || undefined,
        });
        break;

      case 'ADD_HANDOFF':
        createHandoff({
          orgId: activeOrgIdResolved as any,
          userId: action.handoff.userId,
          date: action.handoff.date,
          tasks: action.handoff.tasksSummary.map((t) => ({
            taskId: t.taskId,
            status: t.action,
          })),
        });
        break;

      case 'REQUEST_AVAILABILITY':
        requestAvailability({
          orgId: activeOrgIdResolved as any,
          userId: action.record.memberId,
          type: action.record.type,
          startDate: action.record.startDate,
          endDate: action.record.endDate,
          reason: action.record.notes || undefined,
        });
        break;

      case 'APPROVE_AVAILABILITY':
        approveAvailability({ recordId: action.recordId as any });
        break;

      case 'REJECT_AVAILABILITY':
        rejectAvailability({ recordId: action.recordId as any });
        break;

      case 'CANCEL_AVAILABILITY':
        cancelAvailability({ recordId: action.recordId as any });
        break;

      case 'SET_ORG_SETTINGS':
        updateOrgSettings({
          orgId: activeOrgIdResolved as any,
          settings: {
            noChangeAlertWorkdays: action.settings.noChangeAlertWorkdays ?? 3,
            reworkAlertCycles: action.settings.reworkAlertCycles ?? 3,
          },
        });
        break;

      case 'SIGN_UP': {
        createOrg({
          name: action.orgName,
          industry: action.industry,
          orgStructure: action.orgStructure,
        }).then((orgId) => {
          setActiveOrgId(orgId as string);
        });
        break;
      }

      // These are handled by local state or are no-ops in Convex mode
      case 'SET_ORG_NAME':
      case 'SET_INDUSTRY':
      case 'SET_ADMIN_NAME':
      case 'ADD_SITE':
      case 'REMOVE_SITE':
      case 'FINISH_ONBOARDING':
      case 'SIGN_IN':
      case 'SET_TASKS':
      case 'SET_AUDIT':
      case 'SET_CHECKINS':
      case 'SET_CATEGORIES':
      case 'SET_HANDOFFS':
      case 'SET_AVAILABILITY':
        // No-op or handled differently in Convex mode
        break;
    }
  }, [
    activeOrgIdResolved, signOut,
    createTask, updateTask, reworkTask, createAudit,
    createCheckIn, createHandoff,
    requestAvailability, approveAvailability, rejectAvailability, cancelAvailability,
    createOrg, updateOrgSettings,
  ]);

  // findAccountByEmail is not used in Convex mode (Clerk handles auth)
  const findAccountByEmail = useCallback(() => undefined, []);

  const value = useMemo(() => ({
    state,
    dispatch,
    findAccountByEmail,
  }), [state, dispatch, findAccountByEmail]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// useApp() from AppContext.tsx works automatically since we provide to AppContext
