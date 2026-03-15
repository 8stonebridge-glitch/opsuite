export type Role = 'admin' | 'subadmin' | 'employee';

/** Organization management mode: 'managed' has subadmin leads, 'direct' is admin→employees */
export type OrgMode = 'managed' | 'direct';

export type TaskStatus =
  | 'Open'
  | 'In Progress'
  | 'Completed'
  | 'Pending Approval'
  | 'Verified';

export type Priority = 'low' | 'medium' | 'critical';

export interface Site {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  role: Role;
  teamId?: string;
  teamName?: string;
  siteId?: string;
  siteName?: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  siteId?: string;
  lead: Employee;
  members: Employee[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  site: string;
  siteId: string;
  category?: string;
  priority: Priority;
  due: string | null;
  assignee: string;
  assigneeId: string;
  teamId: string;
  status: TaskStatus;
  assignedBy: string;
  assignedByRole: Role;
  note?: string;
  approved: boolean;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  verifiedBy?: string;
  reworked?: boolean;
  reworkCount?: number;
  lastActivityAt?: string;
  // ── Delegation ──
  accountableLeadId?: string;   // subadmin responsible for delivery
  accountableLeadName?: string;
  delegatedAt?: string;         // ISO timestamp when delegated to employee
  // ── Stalled detection ──
  lastNoChangeAt?: string;      // last "No Change" event date
  stalledDays?: number;
}

export interface AuditEntry {
  id: string;
  taskId: string | null;
  role: string;
  message: string;
  createdAt: string;
  dateTag: string;
  updateType: string;
}

export interface CheckIn {
  userId: string;
  date: string;
  status: 'Checked-In' | 'Missed';
  type: string | null;
  checkedInAt: string | null;
  summary: string | null;
}

export interface Industry {
  id: string;
  name: string;
  sitesLabel: string;
  color: string;
}

export interface OnboardingData {
  orgName: string;
  industry: Industry | null;
  adminName: string;
  sites: Site[];
}

export interface Category {
  id: string;
  name: string;
}

// ── Multi-Org Workspace ──────────────────────────────────────────────

export interface WorkspaceConfig {
  orgName: string;
  industry: Industry | null;
  adminName: string;
  sites: Site[];
  orgSettings: OrgSettings;
  orgMode: OrgMode;
}

export interface WorkspaceData {
  tasks: Task[];
  audit: AuditEntry[];
  checkIns: CheckIn[];
  handoffs: HandoffRecord[];
  categories: Category[];
  teams: Team[];
  availability: AvailabilityRecord[];
  /** Employees not in any team (direct/admin-only mode) */
  standaloneEmployees?: Employee[];
}

export interface Workspace {
  id: string;
  ownerId: string;
  config: WorkspaceConfig;
  data: WorkspaceData;
}

// ── Auth ───────────────────────────────────────────────────────────────
export interface Account {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isDemo: boolean;
  authUserId?: string | null;
}

// ── Derived UI enums (computed, not stored in state) ──────────────────
export type TaskBucket = 'active' | 'review' | 'done';
export type ActiveGroup = 'overdue' | 'stalled' | 'reworked' | 'inProgress' | 'unstarted';

// ── Performance / Accountability ─────────────────────────────────────

export type ScoreBand = 'green' | 'amber' | 'red';

export interface EmployeePerformanceMetrics {
  // Execution (50%)
  overdueRate: number;              // % of active tasks that are overdue
  staleActiveCount: number;         // active tasks with no update for 48h
  onTimeCompletionRate: number;     // % of tasks completed by due date
  criticalResponseRate: number;     // % of critical tasks started within 24h

  // Discipline (50%)
  checkInComplianceRate: number;    // % of workdays checked in (7-day window)
  updateConsistencyRate: number;    // % of in-progress tasks with recent update
  reworkRate: number;               // % of completed tasks that were reworked
  handoffResponseRate: number;      // % of tasks moved to review within 24h of completion
}

export interface EmployeeActionItem {
  id: string;
  severity: ScoreBand;
  label: string;
  count: number;
  target: string;       // human label e.g. "3 overdue tasks"
  route?: string;       // drill-down route
}

export interface EmployeePerformance {
  employeeId: string;
  managerId: string;    // subadmin lead id or 'admin'
  score: number;
  band: ScoreBand;
  trendDelta: number;   // current 7d score minus previous 7d score
  metrics: EmployeePerformanceMetrics;
  actions: EmployeeActionItem[];
  windowStart: string;
  windowEnd: string;
}

export interface SubadminPerformance {
  subadminId: string;
  teamId: string;
  score: number;        // average of team employee scores
  band: ScoreBand;
  trendDelta: number;
  employeeScores: { employeeId: string; score: number; band: ScoreBand }[];
  atRiskCount: number;  // employees in red/amber
  actions: EmployeeActionItem[];
  windowStart: string;
  windowEnd: string;
}

// ── Org Settings ────────────────────────────────────────────────────
export interface OrgSettings {
  noChangeAlertWorkdays: number;  // consecutive no-change workdays before stalled flag
  reworkAlertCycles: number;      // rework cycles before escalation to critical
}

// ── Daily Handoff ───────────────────────────────────────────────────
export interface HandoffTaskSummary {
  taskId: string;
  action: 'update' | 'noChange';
}

export interface HandoffRecord {
  userId: string;
  date: string;
  completedAt: string;
  tasksSummary: HandoffTaskSummary[];
  type: 'tasks_reviewed' | 'no_tasks';
}

// ── Notifications ─────────────────────────────────────────────────
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;       // ISO for sorting
  type: 'task' | 'availability' | 'handoff' | 'coverage' | 'review';
  taskId?: string;          // for task-linked deep-link
  route?: string;           // fallback tab route
}

// ── Availability & Absence ─────────────────────────────────────────
export type AvailabilityType = 'leave' | 'sick' | 'off_duty';
export type AvailabilityStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface AvailabilityRecord {
  id: string;
  organizationId: string;  // workspace id
  memberId: string;
  type: AvailabilityType;
  status: AvailabilityStatus;
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  notes: string;
  requestedById: string;
  approvedById: string | null;
  createdAt: string;        // ISO
  approvedAt: string | null;
}
