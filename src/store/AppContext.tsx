import React, { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import type {
  Task,
  AuditEntry,
  CheckIn,
  Site,
  Team,
  Employee,
  Role,
  OnboardingData,
  Category,
  OrgSettings,
  HandoffRecord,
  Industry,
  Workspace,
  WorkspaceConfig,
  WorkspaceData,
  AvailabilityRecord,
  Account,
} from '../types';
import { getToday, getNowISO } from '../utils/date';
import { uid } from '../utils/id';
import { CATEGORIES_BY_INDUSTRY } from '../constants/categories';
import { INDUSTRIES } from '../constants/industries';
import { generateSeedData, generateTeams, generateAvailabilityRecords } from './seed';
import { hashPassword } from '../utils/auth';

// ── Teams (static demo data — Apex Properties) ──────────────────────────

const makeEmps = (names: string, teamId: string, teamName: string, startIdx: number, prefix = ''): Employee[] =>
  names.split(',').map((n, i) => ({
    id: `${prefix}e${startIdx + i}`,
    name: n.trim(),
    role: 'employee' as Role,
    teamId,
    teamName,
  }));

/** @deprecated Use useTeams() hook instead */
export const TEAMS: Team[] = [
  {
    id: 't1',
    name: 'Maintenance',
    color: '#059669',
    lead: { id: 'e1', name: 'Gregory James', role: 'subadmin', teamId: 't1', teamName: 'Maintenance' },
    members: makeEmps(
      'John Doe,Mary Smith,Chidi Nwankwo,Bola Adeyemi,Fatima Yusuf,Emeka Obi,Ngozi Eze,Tunde Bakare,Halima Sani,Kunle Ojo',
      't1', 'Maintenance', 4
    ),
  },
  {
    id: 't2',
    name: 'Cleaning',
    color: '#2563eb',
    lead: { id: 'e2', name: 'Michael Ade', role: 'subadmin', teamId: 't2', teamName: 'Cleaning' },
    members: makeEmps(
      'Blessing Okoro,Yemi Alade,Samuel Okon,Grace Udo,Ibrahim Musa,Amaka Nwosu,David Ogundimu,Patience Effiong,Ahmed Bello,Chioma Igwe',
      't2', 'Cleaning', 14
    ),
  },
  {
    id: 't3',
    name: 'Security',
    color: '#7c3aed',
    lead: { id: 'e3', name: 'Samuel Obi', role: 'subadmin', teamId: 't3', teamName: 'Security' },
    members: makeEmps(
      'Musa Garba,Rita Okafor,Yakubu Danjuma,Ifeoma Chukwu,Segun Adeniyi,Hauwa Abubakar,Victor Ike,Folake Oladipo,Usman Shehu,Lilian Nkem',
      't3', 'Security', 24
    ),
  },
];

/** @deprecated Use useAllEmployees() hook instead */
export const ALL_EMPLOYEES: Employee[] = TEAMS.flatMap((t) => [
  t.lead,
  ...t.members,
]);

// ── Public State Shape (consumed by all components/selectors) ───────────

export interface AppState {
  onboardingComplete: boolean;
  onboarding: OnboardingData;
  role: Role;
  userId: string | null;
  tasks: Task[];
  audit: AuditEntry[];
  checkIns: CheckIn[];
  categories: Category[];
  orgSettings: OrgSettings;
  handoffs: HandoffRecord[];
  availability: AvailabilityRecord[];
  teams: Team[];
  allEmployees: Employee[];
  // Multi-org
  workspaces: { id: string; orgName: string; industry: Industry | null }[];
  activeWorkspaceId: string;
  // Auth
  isAuthenticated: boolean;
  currentAccountId: string | null;
  currentAccountName: string | null;
  isDemo: boolean;
}

// ── Internal State (workspace registry) ─────────────────────────────────

interface InternalState {
  accounts: Account[];
  currentAccountId: string | null;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  role: Role;
  userId: string | null;
  onboardingComplete: boolean;
}

// ── Projection: InternalState → AppState ────────────────────────────────

const EMPTY_APP_STATE: AppState = {
  onboardingComplete: false,
  onboarding: { orgName: '', industry: null, adminName: '', sites: [] },
  role: 'admin',
  userId: null,
  tasks: [],
  audit: [],
  checkIns: [],
  categories: [],
  orgSettings: { noChangeAlertWorkdays: 3, reworkAlertCycles: 3 },
  handoffs: [],
  availability: [],
  teams: [],
  allEmployees: [],
  workspaces: [],
  activeWorkspaceId: '',
  isAuthenticated: false,
  currentAccountId: null,
  currentAccountName: null,
  isDemo: false,
};

function projectState(internal: InternalState): AppState {
  const currentAccount = internal.accounts.find((a) => a.id === internal.currentAccountId);

  // Not authenticated — return minimal state
  if (!internal.currentAccountId || !currentAccount) {
    return { ...EMPTY_APP_STATE };
  }

  // Filter workspaces to current account
  const ownedWorkspaces = internal.workspaces.filter(
    (w) => w.ownerId === internal.currentAccountId
  );

  const ws = ownedWorkspaces.find((w) => w.id === internal.activeWorkspaceId)
    || ownedWorkspaces[0];

  if (!ws) {
    return {
      ...EMPTY_APP_STATE,
      isAuthenticated: true,
      currentAccountId: internal.currentAccountId,
      currentAccountName: currentAccount.name,
      isDemo: currentAccount.isDemo,
    };
  }

  const allEmployees = ws.data.teams.flatMap((t) => [t.lead, ...t.members]);

  return {
    onboardingComplete: internal.onboardingComplete,
    onboarding: {
      orgName: ws.config.orgName,
      industry: ws.config.industry,
      adminName: ws.config.adminName,
      sites: ws.config.sites,
    },
    role: internal.role,
    userId: internal.userId,
    tasks: ws.data.tasks,
    audit: ws.data.audit,
    checkIns: ws.data.checkIns,
    categories: ws.data.categories,
    orgSettings: ws.config.orgSettings,
    handoffs: ws.data.handoffs,
    availability: ws.data.availability,
    teams: ws.data.teams,
    allEmployees,
    workspaces: ownedWorkspaces.map((w) => ({
      id: w.id,
      orgName: w.config.orgName,
      industry: w.config.industry,
    })),
    activeWorkspaceId: ws.id,
    isAuthenticated: true,
    currentAccountId: internal.currentAccountId,
    currentAccountName: currentAccount.name,
    isDemo: currentAccount.isDemo,
  };
}

// ── Write-back: after flat reducer runs, diff and update active workspace ──

function writeBackToWorkspace(
  internal: InternalState,
  before: AppState,
  after: AppState
): InternalState {
  // If reducer returned the same object, nothing changed
  if (before === after) return internal;

  const wsIndex = internal.workspaces.findIndex((w) => w.id === internal.activeWorkspaceId);
  if (wsIndex < 0) return internal;

  const ws = internal.workspaces[wsIndex];
  let configChanged = false;
  let dataChanged = false;

  // Check config fields
  const newConfig: WorkspaceConfig = { ...ws.config };
  if (after.onboarding.orgName !== before.onboarding.orgName) { newConfig.orgName = after.onboarding.orgName; configChanged = true; }
  if (after.onboarding.industry !== before.onboarding.industry) { newConfig.industry = after.onboarding.industry; configChanged = true; }
  if (after.onboarding.adminName !== before.onboarding.adminName) { newConfig.adminName = after.onboarding.adminName; configChanged = true; }
  if (after.onboarding.sites !== before.onboarding.sites) { newConfig.sites = after.onboarding.sites; configChanged = true; }
  if (after.orgSettings !== before.orgSettings) { newConfig.orgSettings = after.orgSettings; configChanged = true; }

  // Check data fields
  const newData: WorkspaceData = { ...ws.data };
  if (after.tasks !== before.tasks) { newData.tasks = after.tasks; dataChanged = true; }
  if (after.audit !== before.audit) { newData.audit = after.audit; dataChanged = true; }
  if (after.checkIns !== before.checkIns) { newData.checkIns = after.checkIns; dataChanged = true; }
  if (after.handoffs !== before.handoffs) { newData.handoffs = after.handoffs; dataChanged = true; }
  if (after.categories !== before.categories) { newData.categories = after.categories; dataChanged = true; }
  if (after.teams !== before.teams) { newData.teams = after.teams; dataChanged = true; }
  if (after.availability !== before.availability) { newData.availability = after.availability; dataChanged = true; }

  if (!configChanged && !dataChanged) {
    // Only global fields changed (role, userId, onboardingComplete)
    return {
      ...internal,
      role: after.role,
      userId: after.userId,
      onboardingComplete: after.onboardingComplete,
    };
  }

  const updatedWs: Workspace = {
    ...ws,
    config: configChanged ? newConfig : ws.config,
    data: dataChanged ? newData : ws.data,
  };

  const updatedWorkspaces = [...internal.workspaces];
  updatedWorkspaces[wsIndex] = updatedWs;

  return {
    ...internal,
    workspaces: updatedWorkspaces,
    role: after.role,
    userId: after.userId,
    onboardingComplete: after.onboardingComplete,
  };
}

// ── Demo seed ─────────────────────────────────────────────────────────

const DEMO_INDUSTRY: Industry = { id: 'fm', name: 'Facility Management', sitesLabel: 'Properties', color: '#059669' };
const DEMO_SITES: Site[] = [
  { id: 's1', name: 'Lekki Tower' },
  { id: 's2', name: 'Victoria Hub' },
];
const DEMO_ADMIN = 'Sunday Okeke';
const DEMO_CATS = (CATEGORIES_BY_INDUSTRY[DEMO_INDUSTRY.id] || []).map((name, i) => ({ id: String(i + 1), name }));
const DEMO_SEED = generateSeedData(DEMO_INDUSTRY.id, DEMO_SITES, DEMO_ADMIN);

// ── Workspace builders ──────────────────────────────────────────────────

function buildApexWorkspace(): Workspace {
  return {
    id: 'ws-apex',
    ownerId: 'demo-owner',
    config: {
      orgName: 'Apex Properties',
      industry: DEMO_INDUSTRY,
      adminName: DEMO_ADMIN,
      sites: DEMO_SITES,
      orgSettings: { noChangeAlertWorkdays: 3, reworkAlertCycles: 3 },
    },
    data: {
      tasks: DEMO_SEED.tasks,
      audit: DEMO_SEED.audit,
      checkIns: DEMO_SEED.checkIns,
      handoffs: DEMO_SEED.handoffs,
      categories: DEMO_CATS,
      teams: TEAMS,
      availability: generateAvailabilityRecords(TEAMS, 'ws-apex'),
    },
  };
}

function buildSkylineWorkspace(): Workspace {
  const industry: Industry = { id: 'construction', name: 'Construction', sitesLabel: 'Projects', color: '#d97706' };
  const sites: Site[] = [
    { id: 'sky-s1', name: 'Downtown Tower' },
    { id: 'sky-s2', name: 'Marina Bridge' },
  ];
  const teams = generateTeams([
    {
      name: 'Structural',
      color: '#d97706',
      leadName: 'Adamu Bello',
      memberNames: ['Tola Adeyinka', 'Kemi Bankole', 'Olu Fashanu', 'Bisi Coker', 'Dayo Olatunde', 'Aisha Garba', 'Femi Ajibola', 'Ngozi Ike'],
    },
    {
      name: 'MEP',
      color: '#0891b2',
      leadName: 'Chidera Okonkwo',
      memberNames: ['Ifeanyi Uche', 'Funke Adebayo', 'Babajide Ogun', 'Zainab Abubakar', 'Ade Martins', 'Chiamaka Eze', 'Rotimi Lawal', 'Hassana Sule'],
    },
  ], 'sky-');
  const cats = (CATEGORIES_BY_INDUSTRY[industry.id] || []).map((name, i) => ({ id: `sky-c${i + 1}`, name }));
  const seed = generateSeedData(industry.id, sites, DEMO_ADMIN, teams);
  return {
    id: 'ws-skyline',
    ownerId: 'demo-owner',
    config: {
      orgName: 'Skyline Construction',
      industry,
      adminName: DEMO_ADMIN,
      sites,
      orgSettings: { noChangeAlertWorkdays: 2, reworkAlertCycles: 2 },
    },
    data: {
      tasks: seed.tasks,
      audit: seed.audit,
      checkIns: seed.checkIns,
      handoffs: seed.handoffs,
      categories: cats,
      teams,
      availability: generateAvailabilityRecords(teams, 'ws-skyline'),
    },
  };
}

function buildHarborWorkspace(): Workspace {
  const industry: Industry = { id: 'hospitality', name: 'Hospitality', sitesLabel: 'Hotels', color: '#7c3aed' };
  const sites: Site[] = [
    { id: 'har-s1', name: 'Grand Plaza Hotel' },
    { id: 'har-s2', name: 'Riverside Inn' },
  ];
  const teams = generateTeams([
    {
      name: 'Housekeeping',
      color: '#ec4899',
      leadName: 'Folashade Ojo',
      memberNames: ['Ada Nwobi', 'Temitope Osei', 'Uchenna Nweke', 'Mariam Yusuf', 'Sola Adeniran', 'Janet Ekpo', 'Gbenga Olamide', 'Hadiza Musa'],
    },
    {
      name: 'Front Desk',
      color: '#6366f1',
      leadName: 'Emmanuel Obi',
      memberNames: ['Chidinma Ani', 'Abdullahi Idris', 'Mercy Ogbonna', 'Kelvin Asare', 'Bunmi Oladipo', 'Safiya Danladi', 'Tochukwu Ibe', 'Vivian Essien'],
    },
  ], 'har-');
  const cats = (CATEGORIES_BY_INDUSTRY[industry.id] || []).map((name, i) => ({ id: `har-c${i + 1}`, name }));
  const seed = generateSeedData(industry.id, sites, DEMO_ADMIN, teams);
  return {
    id: 'ws-harbor',
    ownerId: 'demo-owner',
    config: {
      orgName: 'Harbor Hotels',
      industry,
      adminName: DEMO_ADMIN,
      sites,
      orgSettings: { noChangeAlertWorkdays: 3, reworkAlertCycles: 3 },
    },
    data: {
      tasks: seed.tasks,
      audit: seed.audit,
      checkIns: seed.checkIns,
      handoffs: seed.handoffs,
      categories: cats,
      teams,
      availability: generateAvailabilityRecords(teams, 'ws-harbor'),
    },
  };
}

const DEMO_ACCOUNT: Account = {
  id: 'demo-owner',
  name: DEMO_ADMIN,
  email: 'owner@opsuite.demo',
  passwordHash: hashPassword('demo1234'),
  isDemo: true,
};

// ── localStorage persistence for multi-tab support ──────────────────────

const AUTH_HINT_KEY = 'opsuite_auth_hint';

interface AuthHint {
  currentAccountId: string;
  activeWorkspaceId: string;
  role: Role;
  accountName: string;
  accountEmail: string;
  isDemo: boolean;
}

function saveAuthHint(hint: AuthHint): void {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(AUTH_HINT_KEY, JSON.stringify(hint));
  } catch { /* quota or private browsing */ }
}

function clearAuthHint(): void {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.removeItem(AUTH_HINT_KEY);
  } catch { /* ignore */ }
}

function loadAuthHint(): AuthHint | null {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = localStorage.getItem(AUTH_HINT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthHint;
  } catch {
    return null;
  }
}

function buildInitialInternalState(): InternalState {
  const base: InternalState = {
    accounts: [DEMO_ACCOUNT],
    currentAccountId: null,
    workspaces: [buildApexWorkspace(), buildSkylineWorkspace(), buildHarborWorkspace()],
    activeWorkspaceId: 'ws-apex',
    role: 'admin',
    userId: null,
    onboardingComplete: true,
  };

  // Hydrate from localStorage so new tabs start with correct auth state
  const hint = loadAuthHint();
  if (hint && !hint.isDemo) {
    const placeholderAccount: Account = {
      id: hint.currentAccountId,
      name: hint.accountName,
      email: hint.accountEmail,
      passwordHash: '',
      isDemo: false,
    };
    return {
      ...base,
      accounts: [...base.accounts, placeholderAccount],
      currentAccountId: hint.currentAccountId,
      activeWorkspaceId: hint.activeWorkspaceId,
      role: hint.role,
      onboardingComplete: true,
    };
  }

  return base;
}

const initialInternalState: InternalState = buildInitialInternalState();

// ── Actions ────────────────────────────────────────────────────────────

export type AppAction =
  | { type: 'SET_ORG_NAME'; name: string }
  | { type: 'SET_INDUSTRY'; industry: OnboardingData['industry'] }
  | { type: 'SET_ADMIN_NAME'; name: string }
  | { type: 'ADD_SITE'; site: Site }
  | { type: 'REMOVE_SITE'; siteId: string }
  | { type: 'ADD_TEAM'; team: Team }
  | { type: 'ADD_MEMBER_TO_TEAM'; teamId: string; member: Employee }
  | { type: 'FINISH_ONBOARDING' }
  | { type: 'SWITCH_USER'; role: Role; userId: string | null }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; taskId: string; updates: Partial<Task> }
  | { type: 'ADD_AUDIT'; entry: Omit<AuditEntry, 'id'> }
  | { type: 'ADD_CHECKIN'; checkIn: CheckIn }
  | { type: 'REWORK_TASK'; taskId: string; reason: string; reworkedBy: string; currentRole: Role }
  | { type: 'SET_TASKS'; tasks: Task[] }
  | { type: 'SET_AUDIT'; entries: AuditEntry[] }
  | { type: 'SET_CHECKINS'; checkIns: CheckIn[] }
  | { type: 'SET_CATEGORIES'; categories: Category[] }
  | { type: 'SET_ORG_SETTINGS'; settings: Partial<OrgSettings> }
  | { type: 'ADD_HANDOFF'; handoff: HandoffRecord }
  | { type: 'SET_HANDOFFS'; handoffs: HandoffRecord[] }
  | { type: 'REQUEST_AVAILABILITY'; record: AvailabilityRecord }
  | { type: 'APPROVE_AVAILABILITY'; recordId: string; approvedById: string }
  | { type: 'REJECT_AVAILABILITY'; recordId: string; approvedById: string }
  | { type: 'CANCEL_AVAILABILITY'; recordId: string }
  | { type: 'SET_AVAILABILITY'; availability: AvailabilityRecord[] }
  | { type: 'SWITCH_ORGANIZATION'; workspaceId: string }
  | {
      type: 'SYNC_EXTERNAL_OWNER';
      authUserId: string;
      name: string;
      email: string;
      workspaces: {
        id: string;
        orgName: string;
        industryId?: string | null;
        orgSettings?: OrgSettings;
      }[];
      activeWorkspaceId: string;
    }
  | {
      type: 'SYNC_EXTERNAL_ACTIVE_STRUCTURE';
      workspaceId: string;
      sites: Site[];
      teams: Team[];
    }
  | { type: 'SIGN_UP'; name: string; email: string; passwordHash: string; orgName: string; industry: Industry; orgStructure: 'with_subadmins' | 'admin_only' }
  | { type: 'SIGN_IN'; accountId: string }
  | { type: 'SIGN_OUT' };

// ── Flat reducer (operates on projected AppState — unchanged from before) ──

type InternalOnlyAction =
  | { type: 'SWITCH_ORGANIZATION' }
  | { type: 'SYNC_EXTERNAL_OWNER' }
  | { type: 'SYNC_EXTERNAL_ACTIVE_STRUCTURE' }
  | { type: 'SIGN_UP' }
  | { type: 'SIGN_IN' }
  | { type: 'SIGN_OUT' };

function getIndustryById(industryId?: string | null): Industry | null {
  if (!industryId) return null;
  return INDUSTRIES.find((industry) => industry.id === industryId) || null;
}

function categoriesForIndustry(industryId?: string | null): Category[] {
  if (!industryId) return [];
  return (CATEGORIES_BY_INDUSTRY[industryId] || []).map((name, index) => ({
    id: `cat-${industryId}-${index + 1}`,
    name,
  }));
}

function flatReducer(state: AppState, action: Exclude<AppAction, InternalOnlyAction>): AppState {
  switch (action.type) {
    case 'SET_ORG_NAME':
      return { ...state, onboarding: { ...state.onboarding, orgName: action.name } };
    case 'SET_INDUSTRY':
      return { ...state, onboarding: { ...state.onboarding, industry: action.industry } };
    case 'SET_ADMIN_NAME':
      return { ...state, onboarding: { ...state.onboarding, adminName: action.name } };
    case 'ADD_SITE':
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          sites: [...state.onboarding.sites, action.site],
        },
      };
    case 'REMOVE_SITE':
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          sites: state.onboarding.sites.filter((s) => s.id !== action.siteId),
        },
      };
    case 'ADD_TEAM':
      return {
        ...state,
        teams: [...state.teams, action.team],
      };
    case 'ADD_MEMBER_TO_TEAM':
      return {
        ...state,
        teams: state.teams.map((team) =>
          team.id === action.teamId
            ? {
                ...team,
                members: [...team.members, action.member].sort((a, b) => a.name.localeCompare(b.name)),
              }
            : team,
        ),
      };
    case 'FINISH_ONBOARDING': {
      const indId = state.onboarding.industry?.id || '';
      const catNames = CATEGORIES_BY_INDUSTRY[indId] || [];
      const categories = catNames.map((name, i) => ({ id: String(i + 1), name }));
      return { ...state, onboardingComplete: true, categories };
    }
    case 'SWITCH_USER':
      return { ...state, role: action.role, userId: action.userId };
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, ...action.updates } : t
        ),
      };
    case 'ADD_AUDIT':
      return { ...state, audit: [...state.audit, { ...action.entry, id: uid() }] };
    case 'ADD_CHECKIN':
      return { ...state, checkIns: [...state.checkIns, action.checkIn] };
    case 'REWORK_TASK': {
      const task = state.tasks.find((t) => t.id === action.taskId);
      if (!task) return state;
      const cycle = (task.reworkCount || 0) + 1;
      const isEscalated = cycle >= state.orgSettings.reworkAlertCycles;
      const today = getToday();
      const now = getNowISO();
      const updatedTask: Task = {
        ...task,
        status: 'In Progress',
        reworked: true,
        reworkCount: cycle,
        priority: isEscalated ? 'critical' : task.priority,
        completedAt: undefined,
        verifiedBy: undefined,
      };
      const newAudit: Omit<AuditEntry, 'id'>[] = [
        {
          taskId: action.taskId,
          role: action.currentRole === 'admin' ? 'Admin' : 'SubAdmin',
          message: `Rework requested by ${action.reworkedBy}: ${action.reason || 'Rework required'}. Cycle ${cycle}.`,
          createdAt: now,
          dateTag: today,
          updateType: 'Rework',
        },
      ];
      if (isEscalated) {
        newAudit.push({
          taskId: action.taskId,
          role: 'System',
          message: `⚠ Escalated to CRITICAL after ${cycle} rework cycles.`,
          createdAt: now,
          dateTag: today,
          updateType: 'Escalation',
        });
      }
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.taskId ? updatedTask : t)),
        audit: [...state.audit, ...newAudit.map((e) => ({ ...e, id: uid() }))],
      };
    }
    case 'SET_TASKS':
      return { ...state, tasks: action.tasks };
    case 'SET_AUDIT':
      return { ...state, audit: action.entries };
    case 'SET_CHECKINS':
      return { ...state, checkIns: action.checkIns };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.categories };
    case 'SET_ORG_SETTINGS':
      return { ...state, orgSettings: { ...state.orgSettings, ...action.settings } };
    case 'ADD_HANDOFF':
      return { ...state, handoffs: [...state.handoffs, action.handoff] };
    case 'SET_HANDOFFS':
      return { ...state, handoffs: action.handoffs };
    case 'REQUEST_AVAILABILITY':
      return { ...state, availability: [...state.availability, action.record] };
    case 'APPROVE_AVAILABILITY':
      return {
        ...state,
        availability: state.availability.map((r) =>
          r.id === action.recordId
            ? { ...r, status: 'approved' as const, approvedById: action.approvedById, approvedAt: getNowISO() }
            : r
        ),
      };
    case 'REJECT_AVAILABILITY':
      return {
        ...state,
        availability: state.availability.map((r) =>
          r.id === action.recordId
            ? { ...r, status: 'rejected' as const, approvedById: action.approvedById, approvedAt: getNowISO() }
            : r
        ),
      };
    case 'CANCEL_AVAILABILITY':
      return {
        ...state,
        availability: state.availability.map((r) =>
          r.id === action.recordId ? { ...r, status: 'cancelled' as const } : r
        ),
      };
    case 'SET_AVAILABILITY':
      return { ...state, availability: action.availability };
    default:
      return state;
  }
}

// ── Wrapper reducer (operates on InternalState) ─────────────────────────

function internalReducer(internal: InternalState, action: AppAction): InternalState {
  // Handle auth & org-switching directly at the internal level
  if (action.type === 'SWITCH_ORGANIZATION') {
    const exists = internal.workspaces.some((w) => w.id === action.workspaceId);
    if (!exists) return internal;
    const currentAccount = internal.accounts.find((a) => a.id === internal.currentAccountId);
    if (currentAccount && !currentAccount.isDemo) {
      saveAuthHint({
        currentAccountId: currentAccount.id,
        activeWorkspaceId: action.workspaceId,
        role: 'admin',
        accountName: currentAccount.name,
        accountEmail: currentAccount.email,
        isDemo: false,
      });
    }
    return {
      ...internal,
      activeWorkspaceId: action.workspaceId,
      role: 'admin',
      userId: null,
    };
  }

  if (action.type === 'SIGN_IN') {
    const account = internal.accounts.find((a) => a.id === action.accountId);
    if (!account) return internal;
    const ownedWs = internal.workspaces.filter((w) => w.ownerId === account.id);
    if (!account.isDemo) {
      saveAuthHint({
        currentAccountId: account.id,
        activeWorkspaceId: ownedWs[0]?.id || internal.activeWorkspaceId,
        role: 'admin',
        accountName: account.name,
        accountEmail: account.email,
        isDemo: false,
      });
    }
    return {
      ...internal,
      currentAccountId: account.id,
      activeWorkspaceId: ownedWs[0]?.id || internal.activeWorkspaceId,
      role: 'admin',
      userId: null,
      onboardingComplete: true,
    };
  }

  if (action.type === 'SIGN_OUT') {
    clearAuthHint();
    // Full reset: clear all non-demo accounts and workspaces to prevent
    // cross-account data leakage (SEC-CRIT-2)
    return {
      accounts: internal.accounts.filter((a) => a.isDemo),
      currentAccountId: null,
      workspaces: internal.workspaces.filter((w) =>
        internal.accounts.some((a) => a.isDemo && a.id === w.ownerId)
      ),
      activeWorkspaceId: 'ws-apex',
      role: 'admin',
      userId: null,
      onboardingComplete: true,
    };
  }

  if (action.type === 'SIGN_UP') {
    const accountId = uid();
    const wsId = `ws-${uid()}`;
    const newAccount: Account = {
      id: accountId,
      name: action.name,
      email: action.email,
      passwordHash: action.passwordHash,
      isDemo: false,
    };
    const catNames = CATEGORIES_BY_INDUSTRY[action.industry.id] || [];
    const categories = catNames.map((name, i) => ({ id: `${wsId}-c${i + 1}`, name }));
    const newWorkspace: Workspace = {
      id: wsId,
      ownerId: accountId,
      config: {
        orgName: action.orgName,
        industry: action.industry,
        adminName: action.name,
        sites: [],
        orgSettings: { noChangeAlertWorkdays: 3, reworkAlertCycles: 3 },
      },
      data: {
        tasks: [],
        audit: [],
        checkIns: [],
        handoffs: [],
        categories,
        teams: [],
        availability: [],
      },
    };
    return {
      ...internal,
      accounts: [...internal.accounts, newAccount],
      workspaces: [...internal.workspaces, newWorkspace],
      currentAccountId: accountId,
      activeWorkspaceId: wsId,
      role: 'admin',
      userId: null,
      onboardingComplete: true,
    };
  }

  if (action.type === 'SYNC_EXTERNAL_OWNER') {
    const email = action.email.trim().toLowerCase();
    const existingAccount = internal.accounts.find((account) => account.email.toLowerCase() === email);
    const accountId = existingAccount?.id || uid();

    const nextAccount: Account = {
      id: accountId,
      name: action.name.trim(),
      email,
      passwordHash: existingAccount?.passwordHash || '',
      isDemo: false,
      authUserId: action.authUserId,
    };

    const otherAccounts = internal.accounts.filter((account) => account.id !== accountId);
    const nextAccounts = [...otherAccounts, nextAccount];

    const existingWorkspaceMap = new Map(
      internal.workspaces
        .filter((workspace) => workspace.ownerId === accountId)
        .map((workspace) => [workspace.id, workspace] as const)
    );

    const syncedWorkspaces: Workspace[] = action.workspaces.map((workspace) => {
      const existingWorkspace = existingWorkspaceMap.get(workspace.id);
      const industry = getIndustryById(workspace.industryId);
      const defaultSettings = workspace.orgSettings || existingWorkspace?.config.orgSettings || {
        noChangeAlertWorkdays: 3,
        reworkAlertCycles: 3,
      };

      if (existingWorkspace) {
        return {
          ...existingWorkspace,
          config: {
            ...existingWorkspace.config,
            orgName: workspace.orgName,
            industry,
            adminName: action.name.trim(),
            orgSettings: defaultSettings,
          },
        };
      }

      return {
        id: workspace.id,
        ownerId: accountId,
        config: {
          orgName: workspace.orgName,
          industry,
          adminName: action.name.trim(),
          sites: [],
          orgSettings: defaultSettings,
        },
        data: {
          tasks: [],
          audit: [],
          checkIns: [],
          handoffs: [],
          categories: categoriesForIndustry(workspace.industryId),
          teams: [],
          availability: [],
        },
      };
    });

    const otherWorkspaces = internal.workspaces.filter((workspace) => workspace.ownerId !== accountId);
    const activeWorkspaceId =
      action.activeWorkspaceId ||
      syncedWorkspaces[0]?.id ||
      internal.activeWorkspaceId;

    saveAuthHint({
      currentAccountId: accountId,
      activeWorkspaceId,
      role: 'admin',
      accountName: nextAccount.name,
      accountEmail: nextAccount.email,
      isDemo: false,
    });

    return {
      ...internal,
      accounts: nextAccounts,
      workspaces: [...otherWorkspaces, ...syncedWorkspaces],
      currentAccountId: accountId,
      activeWorkspaceId,
      role: 'admin',
      userId: null,
      onboardingComplete: true,
    };
  }

  if (action.type === 'SYNC_EXTERNAL_ACTIVE_STRUCTURE') {
    const wsIndex = internal.workspaces.findIndex((workspace) => workspace.id === action.workspaceId);
    if (wsIndex < 0) return internal;

    const targetWorkspace = internal.workspaces[wsIndex];
    const updatedWorkspace: Workspace = {
      ...targetWorkspace,
      config: {
        ...targetWorkspace.config,
        sites: action.sites,
      },
      data: {
        ...targetWorkspace.data,
        teams: action.teams,
      },
    };

    const nextWorkspaces = [...internal.workspaces];
    nextWorkspaces[wsIndex] = updatedWorkspace;

    return {
      ...internal,
      workspaces: nextWorkspaces,
    };
  }

  // For all other actions: project → run flat reducer → write back
  const projectedBefore = projectState(internal);
  const projectedAfter = flatReducer(projectedBefore, action);
  return writeBackToWorkspace(internal, projectedBefore, projectedAfter);
}

// ── Context ────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  findAccountByEmail: (email: string) => Account | undefined;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [internal, dispatch] = useReducer(internalReducer, initialInternalState);
  const state = useMemo(() => projectState(internal), [internal]);

  const findAccountByEmail = useMemo(
    () => (email: string) =>
      internal.accounts.find((a) => a.email.toLowerCase() === email.toLowerCase()),
    [internal.accounts]
  );

  return (
    <AppContext.Provider value={{ state, dispatch, findAccountByEmail }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
